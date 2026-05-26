import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { useParamStore } from '../state/paramStore'
import { simRegistry } from '../state/simRegistry'

/**
 * HDR bloom post-processing for the WebGPU renderer.
 *
 * Builds a node `RenderPipeline` (scene pass → bloom → composite) and presents it from a
 * high-priority `useFrame`. R3F's automatic render is suppressed by `useFrame(..., 1)`
 * (priority ≥ 1), so this owns the final draw. Mount as the LAST child of <Canvas>.
 *
 * Bloom thresholds luminance, so the bright speed-coloured particles glow while the dim
 * container wireframe does not. The bloom node uses render-target ping-pong (no compute),
 * so it also runs on the WebGL2 fallback backend.
 */

/** Bloom tuning per backend: strength, radius, threshold. */
function bloomSettingsForBackend(backend: string): [number, number, number] {
  // GPU compute modes pile tens of thousands of additive sprites into a dense core; a strong
  // bloom turns that into a big halo bleeding to the box edges. Keep it tight and bright-only.
  if (backend === 'webgpu-compute') return [0.18, 0.08, 0.6]
  // Sparser CPU modes benefit from a richer glow.
  return [0.45, 0.15, 0.3]
}

export function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const modeId = useParamStore((s) => s.modeId)
  const pipelineRef = useRef<THREE.RenderPipeline | null>(null)

  // Rebuild the pipeline when the mode (hence backend, hence bloom tuning) changes. Building
  // and disposing in the same effect is StrictMode-safe (cleanup → setup ends on a live build).
  useEffect(() => {
    const backend = simRegistry.create(modeId).backend
    const [strength, radius, threshold] = bloomSettingsForBackend(backend)
    const scenePass = pass(scene, camera)
    const bloomPass = bloom(scenePass, strength, radius, threshold)
    const pipeline = new THREE.RenderPipeline(gl)
    pipeline.outputNode = scenePass.add(bloomPass)
    pipelineRef.current = pipeline
    return () => {
      pipeline.dispose()
      pipelineRef.current = null
    }
  }, [gl, scene, camera, modeId])

  useFrame(() => {
    pipelineRef.current?.render()
  }, 1)

  return null
}
