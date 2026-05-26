import { useMemo } from 'react'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { CpuParticles } from './CpuParticles'
import { GpuNbody } from './gpu/GpuNbody'
import { RapierBodies } from './RapierBodies'

/**
 * Dispatches to the right renderer for the active mode's backend: GPU-resident modes
 * (`webgpu-compute`) render + simulate themselves on the GPU; `rapier` modes draw oriented
 * rigid-body shapes; everything else uses the shared CPU instanced-mesh path. All three are
 * driven by the same SimMode/driver contract. Switching modes swaps the child (each cleans
 * up its own resources on unmount).
 */
export function ParticleField() {
  const modeId = useParamStore((s) => s.modeId)
  const backend = useMemo(() => simRegistry.create(modeId).backend, [modeId])

  if (backend === 'webgpu-compute') return <GpuNbody />
  if (backend === 'rapier') return <RapierBodies />
  return <CpuParticles />
}
