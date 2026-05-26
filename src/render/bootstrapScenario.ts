import { decodeScenarioFromHash } from '../state/shareLink'
import { applyScenario } from './applyScenario'

/**
 * If the page was opened with a scenario in its URL hash (a share link), load it so it wins
 * over the persisted local scenario. Call once at startup, before the first render, so there's
 * no flash of the default setup. Returns true when a scenario was applied.
 */
export function hydrateScenarioFromLocation(): boolean {
  if (typeof window === 'undefined') return false
  const scenario = decodeScenarioFromHash(window.location.hash)
  if (!scenario) return false
  applyScenario(scenario)
  return true
}
