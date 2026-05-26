/**
 * Pure serialization of telemetry into the two export formats (CSV/JSON).
 *
 * Lives in `src/export` (not `sim-core`) but holds no DOM/React dependencies, so it stays
 * unit-testable in the node environment. The render/state layers pass plain history arrays
 * plus the latest `Telemetry` snapshot; this module turns them into download-ready text.
 */
import type { Telemetry } from '../sim-core/types'

/** Time-aligned histories of the two scalar series we chart and export. */
export interface TelemetrySeries {
  speedHistory: number[]
  energyHistory: number[]
}

const CSV_HEADER = 'sample,averageSpeed,kineticEnergy'

/**
 * CSV with header `sample,averageSpeed,kineticEnergy`, one row per sample index up to the
 * longer of the two histories. Ragged arrays leave the missing cell empty (so the two series
 * stay column-aligned by sample index). A single trailing newline keeps every row well-formed
 * without emitting a blank final row.
 */
export function telemetryToCsv(series: TelemetrySeries): string {
  const rowCount = Math.max(series.speedHistory.length, series.energyHistory.length)
  let out = CSV_HEADER + '\n'
  for (let i = 0; i < rowCount; i++) {
    const speed = i < series.speedHistory.length ? String(series.speedHistory[i]) : ''
    const energy = i < series.energyHistory.length ? String(series.energyHistory[i]) : ''
    out += `${i},${speed},${energy}\n`
  }
  return out
}

/**
 * Replace any Float32Array on a telemetry snapshot with a plain number[]. `JSON.stringify`
 * turns a typed array into an index-keyed object (`{"0":..,"1":..}`), which is noisy and
 * lossy to re-parse; converting up front keeps the JSON clean and round-trippable.
 */
function telemetryWithPlainArrays(current: Telemetry): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(current)) {
    clean[key] = value instanceof Float32Array ? Array.from(value) : value
  }
  return clean
}

/**
 * Pretty-printed (2-space) JSON of `{ current, speedHistory, energyHistory }`. `current` may
 * be null (no sim running yet); when present, its typed-array fields are normalized to
 * number[] so the document parses cleanly.
 */
export function telemetryToJson(series: TelemetrySeries, current: Telemetry | null): string {
  const payload = {
    current: current === null ? null : telemetryWithPlainArrays(current),
    speedHistory: series.speedHistory,
    energyHistory: series.energyHistory,
  }
  return JSON.stringify(payload, null, 2)
}
