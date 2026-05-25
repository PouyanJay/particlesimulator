import { useMemo } from 'react'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { CpuParticles } from './CpuParticles'
import { GpuNbody } from './gpu/GpuNbody'

/**
 * Dispatches to the right renderer for the active mode's backend: GPU-resident modes
 * (`webgpu-compute`) render + simulate themselves on the GPU; everything else uses the
 * shared CPU instanced-mesh path driven by a SimMode. Switching modes swaps the child
 * (each cleans up its own GPU resources on unmount).
 */
export function ParticleField() {
  const modeId = useParamStore((s) => s.modeId)
  const backend = useMemo(() => simRegistry.create(modeId).backend, [modeId])

  return backend === 'webgpu-compute' ? <GpuNbody /> : <CpuParticles />
}
