import { countParam, containerParam, displaySizeParam } from '../params/common'
import type { ParticleBuffers, SimMode } from '../types'

/**
 * Schema for the GPU N-body mode. Same physics knobs as the CPU mode but a far higher
 * body cap, since the simulation runs in WebGPU compute shaders.
 */
export const gpuNbodySchema = {
  particleCount: countParam({ label: 'Body Count', default: 10000, min: 1000, max: 100000, step: 1000 }),
  // Mean-field strength (≈ G·total-mass): the kernel divides by body count, so this is
  // count-independent. ~10 gives the CPU mode's feel at any N.
  gravity: { type: 'number', label: 'Gravity Strength', default: 10, min: 1, max: 100, step: 1 },
  softening: { type: 'number', label: 'Softening', default: 0.2, min: 0.05, max: 1, step: 0.01 },
  rotation: { type: 'number', label: 'Initial Spin', default: 0.6, min: 0, max: 2, step: 0.1 },
  containerSize: containerParam({ label: 'Bounds', default: 10, min: 4, max: 20, step: 1 }),
  particleRadius: displaySizeParam({ label: 'Body Size', default: 0.03, min: 0.01, max: 0.1 }),
} as const

const EMPTY_BUFFERS: ParticleBuffers = { count: 0, positions: new Float32Array(0), radius: 0 }

/**
 * GPU N-body is a *metadata-only* mode: its simulation runs on the GPU in the render
 * layer (`<GpuNbody>` with TSL compute), not through this CPU `SimMode` lifecycle. This
 * descriptor exists purely to carry id / label / backend / paramSchema through the
 * registry (mode selector, param store, controls). The render layer dispatches on
 * `backend === 'webgpu-compute'` and never calls the inert lifecycle methods below.
 */
export function createGpuNbodyMode(): SimMode<typeof gpuNbodySchema> {
  return {
    id: 'nbody-gpu',
    label: 'N-Body Gravity (GPU)',
    backend: 'webgpu-compute',
    paramSchema: gpuNbodySchema,
    init: () => {},
    step: () => {},
    getTelemetry: () => ({ particleCount: 0, averageSpeed: 0, kineticEnergy: 0 }),
    getBuffers: () => EMPTY_BUFFERS,
    dispose: () => {},
  }
}
