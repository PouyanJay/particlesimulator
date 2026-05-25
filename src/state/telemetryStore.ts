import { create } from 'zustand'
import type { Telemetry } from '../sim-core/types'

/** Maximum number of samples retained in the rolling telemetry history. */
export const TELEMETRY_HISTORY_LIMIT = 200

interface TelemetryState {
  /** The most recent telemetry sample, or null before the sim has run. */
  current: Telemetry | null
  /** Rolling history of average speed for the live chart. */
  speedHistory: number[]
  /** Record a sample (called at a throttled rate by the render layer, not every frame). */
  push: (sample: Telemetry) => void
  reset: () => void
}

/**
 * Transient telemetry store — deliberately separate from the param store and never
 * persisted, so high-frequency writes don't pollute scenario state or (later) undo
 * history. Charts subscribe here; the hot sim loop never does. See CLAUDE.md.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  current: null,
  speedHistory: [],
  push: (sample) =>
    set((s) => {
      const appended = [...s.speedHistory, sample.averageSpeed]
      const speedHistory =
        appended.length > TELEMETRY_HISTORY_LIMIT
          ? appended.slice(appended.length - TELEMETRY_HISTORY_LIMIT)
          : appended
      return { current: sample, speedHistory }
    }),
  reset: () => set({ current: null, speedHistory: [] }),
}))
