import * as THREE from 'three/webgpu'
import { extend, type ThreeToJSXElements } from '@react-three/fiber'

/**
 * Registers all `three/webgpu` classes (including node materials) as React Three Fiber
 * JSX intrinsic elements, and augments R3F's element types to match. Import this once
 * for its side effect before any `<Canvas>` renders (SimulationCanvas does).
 *
 * TSL node materials and the WebGPURenderer come from `three/webgpu`; the renderer
 * auto-falls back to a WebGL2 backend when WebGPU is unavailable, and one node-material
 * source serves both backends.
 */
declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as unknown as Parameters<typeof extend>[0])
