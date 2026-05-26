/**
 * Composable, pure check builders for guided lab challenges.
 *
 * Each builder returns a `ChallengeCheck` whose `evaluate` is a small, side-effect-free
 * predicate over a `ChallengeContext`. They are deliberately tiny and obviously correct:
 * the pedagogy lives in the library; these are just the comparison atoms it composes.
 *
 * All numeric-telemetry checks guard `undefined` → `false` so a check on a field a mode
 * does not report (e.g. `pressure` on N-body) simply never passes rather than throwing.
 */
import type { Telemetry } from '../types'
import type { ChallengeCheck, ChallengeContext } from './types'

/**
 * The numeric `Telemetry` fields a check can compare against. Restricting to numeric keys
 * (excludes `speedSamples`, `momentum`, `inelastic`) keeps the comparison well-typed and
 * stops a check from accidentally targeting an array/boolean field.
 */
export type NumericTelemetryField = {
  [K in keyof Telemetry]-?: NonNullable<Telemetry[K]> extends number ? K : never
}[keyof Telemetry]

/** Read a numeric telemetry field, or `undefined` if the mode does not report it. */
function readNumeric(telemetry: Telemetry, field: NumericTelemetryField): number | undefined {
  const value = telemetry[field]
  return typeof value === 'number' ? value : undefined
}

/** Pass when `telemetry[field] >= value`. Undefined field ⇒ false. */
export function telemetryAtLeast(field: NumericTelemetryField, value: number): ChallengeCheck {
  return {
    describe: `${field} ≥ ${value}`,
    evaluate: (ctx: ChallengeContext): boolean => {
      const current = readNumeric(ctx.telemetry, field)
      return current !== undefined && current >= value
    },
  }
}

/** Pass when `telemetry[field] <= value`. Undefined field ⇒ false. */
export function telemetryAtMost(field: NumericTelemetryField, value: number): ChallengeCheck {
  return {
    describe: `${field} ≤ ${value}`,
    evaluate: (ctx: ChallengeContext): boolean => {
      const current = readNumeric(ctx.telemetry, field)
      return current !== undefined && current <= value
    },
  }
}

/** Pass when the control-panel param `key` equals `value` (strict equality). */
export function paramEquals(key: string, value: number | boolean): ChallengeCheck {
  return {
    describe: `${key} = ${value}`,
    evaluate: (ctx: ChallengeContext): boolean => ctx.params[key] === value,
  }
}

/**
 * Pass when `telemetry[field]` has risen above its baseline by at least `byFactor`
 * (default 1, i.e. any increase). Requires `ctx.baseline` — without it (or without a
 * current value) the check cannot be relative, so it returns false rather than guessing.
 */
export function telemetryIncreasedFrom(field: NumericTelemetryField, byFactor = 1): ChallengeCheck {
  return {
    describe: byFactor === 1 ? `${field} increased` : `${field} increased by ${byFactor}×`,
    evaluate: (ctx: ChallengeContext): boolean => {
      const current = readNumeric(ctx.telemetry, field)
      const base = ctx.baseline ? readNumeric(ctx.baseline, field) : undefined
      if (current === undefined || base === undefined) return false
      return current > base * byFactor
    },
  }
}
