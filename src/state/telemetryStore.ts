import { create } from 'zustand'
import type { Telemetry } from '../sim-core/types'

/** Maximum number of samples retained in the rolling telemetry history. */
export const TELEMETRY_HISTORY_LIMIT = 200

interface TelemetryState {
  /** The most recent telemetry sample, or null before the sim has run. */
  current: Telemetry | null
  /** Rolling history of average speed for the live chart. */
  speedHistory: number[]
  /** Rolling history of total kinetic energy for the live chart. */
  energyHistory: number[]
  /** Record a sample (called at a throttled rate by the render layer, not every frame). */
  push: (sample: Telemetry) => void
  reset: () => void
}

/** Append to a rolling history, capped at TELEMETRY_HISTORY_LIMIT. */
function appendCapped(history: number[], value: number): number[] {
  const next = [...history, value]
  return next.length > TELEMETRY_HISTORY_LIMIT ? next.slice(next.length - TELEMETRY_HISTORY_LIMIT) : next
}

/**
 * Transient telemetry store — deliberately separate from the param store and never
 * persisted, so high-frequency writes don't pollute scenario state or (later) undo
 * history. Charts subscribe here; the hot sim loop never does. See CLAUDE.md.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  current: null,
  speedHistory: [],
  energyHistory: [],
  push: (sample) =>
    set((s) => ({
      current: sample,
      speedHistory: appendCapped(s.speedHistory, sample.averageSpeed),
      energyHistory: appendCapped(s.energyHistory, sample.kineticEnergy),
    })),
  reset: () => set({ current: null, speedHistory: [], energyHistory: [] }),
}))
