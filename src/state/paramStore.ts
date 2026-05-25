import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { defaultParamValues } from '../sim-core/paramSchema'
import type { ParamValue } from '../sim-core/types'
import { simRegistry } from './simRegistry'
import { clientStorage } from './clientStorage'

export type { ParamValue }

const INITIAL_MODE_ID = 'elastic-gas'

/** Default parameter values for a mode, derived from its schema. */
function defaultsFor(modeId: string): Record<string, ParamValue> {
  return defaultParamValues(simRegistry.create(modeId).paramSchema)
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

  setParam: (key: string, value: ParamValue) => void
  selectMode: (modeId: string) => void
  resetParams: () => void
  setSeed: (seed: number) => void
  randomizeSeed: () => void
  setPlaying: (isPlaying: boolean) => void
  togglePlaying: () => void
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

      setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
      selectMode: (modeId) => set({ modeId, params: defaultsFor(modeId) }),
      resetParams: () => set((s) => ({ params: defaultsFor(s.modeId) })),
      setSeed: (seed) => set({ seed }),
      randomizeSeed: () => set({ seed: Math.floor(Math.random() * 0xffffffff) }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
    }),
    {
      name: 'particle-lab:params',
      storage: createJSONStorage(() => clientStorage),
      // Persist the scenario only — not the transient playback flag.
      partialize: (s) => ({ modeId: s.modeId, seed: s.seed, params: s.params }),
    },
  ),
)
