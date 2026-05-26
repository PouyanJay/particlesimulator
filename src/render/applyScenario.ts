import { useParamStore } from '../state/paramStore'
import { applyCameraPose, queueCameraPose } from './cameraBridge'
import type { Scenario } from '../sim-core/scenario'

/**
 * Restore a full scenario (from a shared URL, a saved preset, a curated scenario, or a JSON
 * import): load the mode/params/seed/substance/view into the store, then position the camera.
 *
 * Camera ordering matters. If the mode or projection changes, the camera rig re-frames the
 * scene on its next sync; we *queue* the saved pose so it overrides that default framing.
 * If neither changed (e.g. a preset for the current view), the rig won't re-run, so we apply
 * the pose directly. Lives in the render layer because it bridges the store and the camera.
 */
export function applyScenario(scenario: Scenario): void {
  const prev = useParamStore.getState()
  const viewChanged = prev.view !== (scenario.view ?? '3d')
  const modeChanged = prev.modeId !== scenario.modeId

  useParamStore.getState().loadScenario(scenario)

  if (scenario.camera) {
    if (modeChanged || viewChanged) queueCameraPose(scenario.camera)
    else applyCameraPose(scenario.camera)
  }
}
