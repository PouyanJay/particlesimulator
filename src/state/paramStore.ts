import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { defaultParamValues } from '../sim-core/paramSchema'
import type { ParamValue } from '../sim-core/types'
import type { CameraPose, Scenario, SimView } from '../sim-core/scenario'
import { simRegistry } from './simRegistry'
import { clientStorage } from './clientStorage'

export type { ParamValue }

const INITIAL_MODE_ID = 'elastic-gas'

/** Default parameter values for a mode, derived from its schema. */
function defaultsFor(modeId: string): Record<string, ParamValue> {
  return defaultParamValues(simRegistry.create(modeId).paramSchema)
}

/**
 * Reconcile persisted state with the freshly-initialised state on rehydration. A persisted
 * `modeId` can name a mode that no longer exists (e.g. one removed between sessions); creating
 * an unknown mode throws and blanks the entire app, so we fall back to the default mode and its
 * params when the saved mode isn't in the registry. Other prefs (seed, substance) are preserved.
 * Exported for direct unit testing of this resilience.
 */
export function mergePersistedState(persisted: unknown, current: ParamState): ParamState {
  const saved = (persisted ?? {}) as Partial<ParamState>
  const merged = { ...current, ...saved } // saved holds only the partialized data fields; keep current's actions
  if (typeof merged.modeId !== 'string' || !simRegistry.has(merged.modeId)) {
    merged.modeId = INITIAL_MODE_ID
    merged.params = defaultsFor(INITIAL_MODE_ID)
  }
  return merged
}

interface ParamState {
  /** The active simulation mode id. */
  modeId: string
  /** Seed for deterministic (re)initialisation. */
  seed: number
  /** Playback state (not persisted — transient UI concern). */
  isPlaying: boolean
  /** Current parameter values for the active mode. */
  params: Record<string, ParamValue>
  /**
   * Display unit system: 'reduced' (dimensionless, the default) or a substance id (e.g.
   * 'argon') that maps the Lennard-Jones gas readouts to real SI. A view preference, not a
   * simulation parameter — it never affects the dynamics, only how values are labelled.
   */
  substanceId: string
  /** Render projection: '3d' orbit view (default) or the orthographic high-count 2D tier. */
  view: SimView

  setParam: (key: string, value: ParamValue) => void
  selectMode: (modeId: string) => void
  resetParams: () => void
  setSeed: (seed: number) => void
  randomizeSeed: () => void
  setPlaying: (isPlaying: boolean) => void
  togglePlaying: () => void
  setSubstance: (substanceId: string) => void
  setView: (view: SimView) => void
  /**
   * Replace the whole scenario at once (mode + params + seed + substance + view) without
   * resetting params to the mode's defaults — used to restore a shared URL, a saved preset,
   * or a curated scenario. Camera is handled separately by the render layer (see cameraBridge).
   */
  loadScenario: (scenario: Scenario) => void
}

/**
 * Build a serializable Scenario from the current store state, optionally pinning the camera.
 * Pure (takes state in) so it's trivially testable and reusable for share/preset/export.
 */
export function scenarioFromState(state: ParamState, camera?: CameraPose): Scenario {
  const scenario: Scenario = {
    modeId: state.modeId,
    seed: state.seed,
    params: state.params,
    substanceId: state.substanceId,
    view: state.view,
  }
  if (camera) scenario.camera = camera
  return scenario
}

/**
 * The scenario parameter store: active mode, seed, and per-mode parameter values.
 * This is the UI's source of truth and is read inside the sim loop via `getState()`
 * (no re-render). High-frequency telemetry lives in a separate store so it never
 * pollutes this persisted, scenario-defining state. See CLAUDE.md.
 */
export const useParamStore = create<ParamState>()(
  persist(
    (set) => ({
      modeId: INITIAL_MODE_ID,
      seed: 1,
      isPlaying: true,
      params: defaultsFor(INITIAL_MODE_ID),
      substanceId: 'reduced',
      view: '3d',

      setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
      selectMode: (modeId) => set({ modeId, params: defaultsFor(modeId) }),
      resetParams: () => set((s) => ({ params: defaultsFor(s.modeId) })),
      setSeed: (seed) => set({ seed }),
      randomizeSeed: () => set({ seed: Math.floor(Math.random() * 0xffffffff) }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
      setSubstance: (substanceId) => set({ substanceId }),
      setView: (view) => set({ view }),
      loadScenario: (scenario) =>
        set({
          modeId: scenario.modeId,
          seed: scenario.seed,
          params: { ...scenario.params },
          substanceId: scenario.substanceId ?? 'reduced',
          view: scenario.view ?? '3d',
        }),
    }),
    {
      name: 'particle-lab:params',
      // Bump when the mode set or schemas change so incompatible persisted state is
      // discarded (rather than rehydrating stale params for a since-changed schema).
      // v2: elastic-gas gravity became a strength slider (was a boolean toggle).
      // v3: added the `view` (2D/3D) projection to the persisted scenario.
      version: 3,
      storage: createJSONStorage(() => clientStorage),
      // Persist the scenario + the display unit system — not the transient playback flag.
      partialize: (s) => ({
        modeId: s.modeId,
        seed: s.seed,
        params: s.params,
        substanceId: s.substanceId,
        view: s.view,
      }),
      // Drop a scenario whose mode no longer exists so a stale modeId can't crash the app.
      merge: (persisted, current) => mergePersistedState(persisted, current as ParamState),
    },
  ),
)
