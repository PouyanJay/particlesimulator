import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

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
export function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const pipelineRef = useRef<THREE.RenderPipeline | null>(null)

  // StrictMode-safe: build lazily; dispose + null on unmount so the React 19 double-mount
  // recreates the pipeline instead of reusing disposed render targets.
  if (!pipelineRef.current) {
    const scenePass = pass(scene, camera)
    // Tight, bright-only glow: a small radius avoids the dense cluster's blooms merging
    // into a broad halo, and a higher threshold keeps dim pixels out of the bloom.
    const bloomPass = bloom(scenePass, 0.45, 0.15, 0.3) // strength, radius, threshold
    const pipeline = new THREE.RenderPipeline(gl)
    pipeline.outputNode = scenePass.add(bloomPass)
    pipelineRef.current = pipeline
  }

  useFrame(() => {
    pipelineRef.current?.render()
  }, 1)

  useEffect(() => {
    return () => {
      pipelineRef.current?.dispose()
      pipelineRef.current = null
    }
  }, [])

  return null
}
