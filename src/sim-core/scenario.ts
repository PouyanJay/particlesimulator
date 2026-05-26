import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { ParamValue } from './types'

/**
 * A scenario is the complete, reproducible description of a setup — everything needed to
 * recreate what someone sees, without serializing raw particle state (per tech-decisions:
 * store seed + params + mode + camera, regenerate the rest). It is the unit of save, share,
 * and preset. Pure data; no React, no three.js.
 */

/** Camera framing, captured so a shared link opens from the same viewpoint. */
export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

/** Render projection: standard 3D orbit view, or the orthographic high-count 2D tier. */
export type SimView = '3d' | '2d'

export interface Scenario {
  modeId: string
  seed: number
  params: Record<string, ParamValue>
  /** Display unit system (e.g. 'reduced', 'argon'). View preference, not dynamics. */
  substanceId?: string
  /** Captured camera framing; absent ⇒ use the mode's default framing. */
  camera?: CameraPose
  /** Projection; absent ⇒ '3d'. */
  view?: SimView
}

/**
 * Bump when the on-the-wire shape changes incompatibly. Older/newer payloads are rejected
 * (decoded to null) rather than rehydrated into a mismatched shape — a shared URL from a
 * future build should fail closed, not corrupt state.
 */
export const SCENARIO_VERSION = 1

interface EncodedScenario {
  v: number
  modeId: string
  seed: number
  params: Record<string, ParamValue>
  substanceId?: string
  camera?: CameraPose
  view?: SimView
}

/** Encode a scenario into a compact, URL-hash-safe string (lz-string over JSON). */
export function serializeScenario(scenario: Scenario): string {
  const payload: EncodedScenario = {
    v: SCENARIO_VERSION,
    modeId: scenario.modeId,
    seed: scenario.seed,
    params: scenario.params,
  }
  if (scenario.substanceId !== undefined) payload.substanceId = scenario.substanceId
  if (scenario.camera !== undefined) payload.camera = scenario.camera
  if (scenario.view !== undefined) payload.view = scenario.view
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

/**
 * Decode a scenario from an encoded string. Returns null for anything that isn't a
 * structurally-valid scenario of the current version — the input comes from an untrusted
 * URL, so this must never throw and must reject garbage.
 */
export function deserializeScenario(encoded: string): Scenario | null {
  if (!encoded) return null
  let json: string | null
  try {
    json = decompressFromEncodedURIComponent(encoded)
  } catch {
    return null
  }
  if (!json) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  return validate(parsed)
}

/** Pretty-printed JSON of a scenario, for file export/import (human-readable, not compressed). */
export function scenarioToJson(scenario: Scenario): string {
  const payload: EncodedScenario = {
    v: SCENARIO_VERSION,
    modeId: scenario.modeId,
    seed: scenario.seed,
    params: scenario.params,
  }
  if (scenario.substanceId !== undefined) payload.substanceId = scenario.substanceId
  if (scenario.camera !== undefined) payload.camera = scenario.camera
  if (scenario.view !== undefined) payload.view = scenario.view
  return JSON.stringify(payload, null, 2)
}

/** Parse a scenario from exported JSON text; returns null for anything invalid (untrusted file). */
export function scenarioFromJson(text: string): Scenario | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  return validate(parsed)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isParamRecord(value: unknown): value is Record<string, ParamValue> {
  if (!isPlainObject(value)) return false
  // Reject non-finite numbers (NaN/±Infinity) from an untrusted URL/file — they would feed
  // straight into mode.init and corrupt the sim. Booleans pass as-is.
  return Object.values(value).every(
    (v) => (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean',
  )
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

function isCameraPose(value: unknown): value is CameraPose {
  return isPlainObject(value) && isVec3(value.position) && isVec3(value.target)
}

function validate(parsed: unknown): Scenario | null {
  if (!isPlainObject(parsed)) return null
  if (parsed.v !== SCENARIO_VERSION) return null
  if (typeof parsed.modeId !== 'string' || parsed.modeId.length === 0) return null
  if (typeof parsed.seed !== 'number' || !Number.isFinite(parsed.seed)) return null
  if (!isParamRecord(parsed.params)) return null

  const scenario: Scenario = { modeId: parsed.modeId, seed: parsed.seed, params: parsed.params }

  if (parsed.substanceId !== undefined) {
    if (typeof parsed.substanceId !== 'string') return null
    scenario.substanceId = parsed.substanceId
  }
  if (parsed.camera !== undefined) {
    if (!isCameraPose(parsed.camera)) return null
    scenario.camera = parsed.camera
  }
  if (parsed.view !== undefined) {
    if (parsed.view !== '2d' && parsed.view !== '3d') return null
    scenario.view = parsed.view
  }
  return scenario
}
