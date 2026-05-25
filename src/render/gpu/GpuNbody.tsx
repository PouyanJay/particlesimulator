import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three/webgpu'
import { createNbodyGpu, type NbodyGpu } from './nbodyCompute'
import { seedNbodyDisk } from '../../sim-core/modes/nbodySeed'
import { useParamStore } from '../../state/paramStore'

const FIXED_DT = 1 / 90
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
    return () => {
      built.dispose()
      setGpu(null)
    }
  }, [seed, params])

  const accumulatorRef = useRef(0)
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
  })

  return gpu ? <primitive object={gpu.sprite} /> : null
}
