import { useEffect, useRef } from 'react'
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
 * the store and re-seeds the buffers when they change (mirrors the CPU reload behavior).
 */
export function GpuNbody() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer

  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // Rebuild buffers/kernels/sprite when seed or any parameter changes. Done in the render
  // body (like the StrictMode-safe lazy init elsewhere): dispose the previous build, and
  // recreate after a StrictMode unmount nulls the ref.
  const gpuRef = useRef<NbodyGpu | null>(null)
  const keyRef = useRef<{ seed: number; params: unknown } | null>(null)
  if (!gpuRef.current || keyRef.current?.seed !== seed || keyRef.current?.params !== params) {
    gpuRef.current?.dispose()
    const count = num(params.particleCount, 0)
    const containerSize = num(params.containerSize, 10)
    const rotation = num(params.rotation, 0)
    const radius = num(params.particleRadius, 0.03)
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    seedNbodyDisk(seed, count, containerSize, rotation, positions, velocities)
    gpuRef.current = createNbodyGpu(count, positions, velocities, radius)
    keyRef.current = { seed, params }
  }
  const gpu = gpuRef.current

  useEffect(() => {
    return () => {
      gpuRef.current?.dispose()
      gpuRef.current = null
      keyRef.current = null
    }
  }, [])

  const accumulatorRef = useRef(0)
  useFrame((_, delta) => {
    const active = gpuRef.current
    if (!active) return

    // Drive uniforms from the param store (read in the loop, never via props).
    active.uniforms.g.value = num(params.gravity, 0.02)
    const soft = num(params.softening, 0.2)
    active.uniforms.softeningSq.value = soft * soft
    active.uniforms.dt.value = FIXED_DT
    active.uniforms.halfBound.value = num(params.containerSize, 10) / 2 - num(params.particleRadius, 0.03)

    if (!useParamStore.getState().isPlaying) return
    accumulatorRef.current += Math.min(delta, 0.1) // clamp to avoid the spiral of death
    while (accumulatorRef.current >= FIXED_DT) {
      gl.compute(active.computeVelocity)
      gl.compute(active.computePosition)
      accumulatorRef.current -= FIXED_DT
    }
  })

  return <primitive object={gpu.sprite} />
}
