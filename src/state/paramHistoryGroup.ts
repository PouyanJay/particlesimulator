import { useParamStore, trackedSlice, trackedEqual, HISTORY_LIMIT, type TrackedScenario } from './paramStore'

/**
 * Coalesces a burst of param edits (e.g. a continuous slider drag) into a single undo step.
 *
 * `begin()` snapshots the pre-edit scenario and pauses zundo tracking, so the many intermediate
 * values written during the drag don't each become history. `end()` resumes tracking and, only
 * if the scenario actually changed, pushes the single pre-edit snapshot as one undo entry. A
 * drag that changes nothing (a click without movement) records nothing.
 *
 * Timer-free and deterministic — drive it from pointer down/up (see RangeField / ControlPanel).
 */
let snapshot: TrackedScenario | null = null

export function beginParamHistoryGroup(): void {
  // Snapshot the current scenario; ignore re-entrant begins (single active drag).
  if (snapshot !== null) return
  snapshot = trackedSlice(useParamStore.getState())
  useParamStore.temporal.getState().pause()
}

export function endParamHistoryGroup(): void {
  const before = snapshot
  snapshot = null
  const temporal = useParamStore.temporal.getState()
  temporal.resume()
  if (!before) return
  const now = trackedSlice(useParamStore.getState())
  if (trackedEqual(before, now)) return // no net change → no history entry
  useParamStore.temporal.setState((s) => ({
    pastStates: [...s.pastStates, before].slice(-HISTORY_LIMIT),
    futureStates: [], // a new edit invalidates the redo stack
  }))
}
