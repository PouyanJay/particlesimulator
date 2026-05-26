import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three/webgpu'
import { createNbodyGpu, type NbodyGpu } from './nbodyCompute'
import { seedNbodyDisk } from '../../sim-core/modes/nbodySeed'
import { useParamStore } from '../../state/paramStore'
import { useTelemetryStore } from '../../state/telemetryStore'

const FIXED_DT = 1 / 90
// How often (simulated seconds) to read the GPU velocity buffer back for the readouts —
// matches the CPU driver's telemetry cadence. Read-back is a GPU→CPU copy, so it's throttled.
const TELEMETRY_INTERVAL = 0.5
const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback)

/**
 * GPU-resident N-body renderer/simulator. Owns its storage buffers, TSL compute kernels,
 * and instanced-sprite render object; the simulation runs entirely on the GPU. Selected
 * via the `webgpu-compute` backend (see ParticleField dispatcher). Reads params/seed from
 * the store and rebuilds the buffers when they change (mirrors the CPU reload behavior).
 */
export function GpuNbody() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer

  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // Build the GPU buffers/kernels/sprite from the scenario, rebuilding when the seed or any
  // param changes. This lives in an effect (not the render body) so React owns the lifecycle:
  // the cleanup disposes, StrictMode's mount→unmount→remount reliably ends on a fresh build,
  // and `setGpu` triggers the re-render that actually draws the new sprite. Building in the
  // render body instead left a disposed sprite on screen after the StrictMode dance — visible
  // as the "switch to/from GPU N-body needs selecting twice" bug, since only a second select
  // (a new `params` object) forced the render that rebuilt it.
  const [gpu, setGpu] = useState<NbodyGpu | null>(null)
  useEffect(() => {
    const count = num(params.particleCount, 0)
    const containerSize = num(params.containerSize, 10)
    const rotation = num(params.rotation, 0)
    const radius = num(params.particleRadius, 0.03)
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    seedNbodyDisk(seed, count, containerSize, rotation, positions, velocities)
    const built = createNbodyGpu(count, positions, velocities, radius)
    setGpu(built)
    // Clear the panel of any previous (CPU-mode) readings; GPU read-back repopulates it.
    useTelemetryStore.getState().reset()
    return () => {
      built.dispose()
      setGpu(null)
    }
  }, [seed, params])

  const accumulatorRef = useRef(0)
  const telemetryAccumRef = useRef(0)
  const readingBackRef = useRef(false)
  useFrame((_, delta) => {
    if (!gpu) return

    // Drive uniforms from the param store (read in the loop, never via props).
    // Normalize gravity by body count (mean-field): all-pairs acceleration scales with N,
    // so dividing keeps "Gravity Strength" stable across counts and avoids blow-up at 20k+.
    const count = Math.max(1, num(params.particleCount, 1))
    gpu.uniforms.g.value = num(params.gravity, 0.02) / count
    const soft = num(params.softening, 0.2)
    gpu.uniforms.softeningSq.value = soft * soft
    gpu.uniforms.dt.value = FIXED_DT
    gpu.uniforms.halfBound.value = num(params.containerSize, 10) / 2 - num(params.particleRadius, 0.03)

    if (!useParamStore.getState().isPlaying) return
    accumulatorRef.current += Math.min(delta, 0.1) // clamp to avoid the spiral of death
    while (accumulatorRef.current >= FIXED_DT) {
      gl.compute(gpu.computeVelocity)
      gl.compute(gpu.computePosition)
      accumulatorRef.current -= FIXED_DT
    }

    // Periodically read the velocity buffer back to the CPU and publish the same conserved
    // quantities the CPU modes report. Throttled, and skipped while a read-back is in flight
    // (getArrayBufferAsync is async), so it never stalls the render loop.
    telemetryAccumRef.current += Math.min(delta, 0.1)
    if (telemetryAccumRef.current >= TELEMETRY_INTERVAL && !readingBackRef.current) {
      telemetryAccumRef.current = 0
      readingBackRef.current = true
      void publishTelemetry(gl, gpu.velocityAttribute, count).finally(() => {
        readingBackRef.current = false
      })
    }
  })

  return gpu ? <primitive object={gpu.sprite} /> : null
}

/**
 * Read the GPU velocity buffer back and push kinetic energy, average speed, and total
 * momentum to the telemetry store. The buffer is xyz-interleaved; we derive the per-element
 * stride from the returned length so it's correct whether the backend packs vec3 tightly
 * (stride 3) or pads to 16 bytes (stride 4).
 */
async function publishTelemetry(
  gl: THREE.WebGPURenderer,
  velocityAttribute: THREE.BufferAttribute,
  count: number,
): Promise<void> {
  const buffer = await gl.getArrayBufferAsync(velocityAttribute)
  const v = new Float32Array(buffer)
  if (count <= 0 || v.length < count * 3) return
  const stride = Math.floor(v.length / count)

  let speedSum = 0
  let keSum = 0
  let px = 0
  let py = 0
  let pz = 0
  const speedSamples = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * stride
    const x = v[o]
    const y = v[o + 1]
    const z = v[o + 2]
    const speedSq = x * x + y * y + z * z
    const speed = Math.sqrt(speedSq)
    speedSamples[i] = speed
    speedSum += speed
    keSum += speedSq
    px += x
    py += y
    pz += z
  }
  useTelemetryStore.getState().push({
    particleCount: count,
    averageSpeed: speedSum / count,
    kineticEnergy: 0.5 * keSum, // unit mass
    speedSamples,
    momentum: [px, py, pz],
  })
}
