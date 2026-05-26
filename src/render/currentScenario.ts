import { useParamStore, scenarioFromState } from '../state/paramStore'
import { captureCameraPose } from './cameraBridge'
import type { Scenario } from '../sim-core/scenario'

/** Snapshot the live scenario including the current camera framing (when the canvas is mounted). */
export function currentScenario(): Scenario {
  return scenarioFromState(useParamStore.getState(), captureCameraPose() ?? undefined)
}
