/**
 * Phase 5 "guided lab challenges" — pure data model.
 *
 * A challenge is a sequence of pedagogical steps layered *on top of* an existing
 * `SimMode` (referenced by `modeId`). The model is intentionally inert: it carries
 * prompts, hints, and optional auto-graded success criteria, but contains no React,
 * no timers, and no simulation logic. The runner UI (built later) drives a challenge
 * by feeding live telemetry + params into each step's `check.evaluate`.
 *
 * Keeping this in `sim-core` (pure TS) means the whole challenge library is
 * unit-testable in isolation and shares the same `Telemetry` contract the modes emit.
 */
import type { Telemetry } from '../types'

/**
 * The runtime inputs a check evaluates against. Assembled by the runner each tick
 * from the active mode's telemetry and the current control-panel param values.
 */
export interface ChallengeContext {
  telemetry: Telemetry
  params: Record<string, number | boolean>
  /** Telemetry captured when the current step began, for relative ("increased") checks. */
  baseline?: Telemetry
}

export interface ChallengeCheck {
  /** Human-readable success criterion shown in the UI. */
  describe: string
  /** Pure predicate; true ⇒ the step's goal is met. */
  evaluate: (ctx: ChallengeContext) => boolean
}

export interface ChallengeStep {
  id: string
  /** Instruction or question shown to the learner. */
  prompt: string
  hint?: string
  /** Optional auto-graded success criterion; steps without one are advanced manually. */
  check?: ChallengeCheck
}

export interface Challenge {
  id: string
  /** The `SimMode.id` this challenge runs against (e.g. 'elastic-gas'). */
  modeId: string
  title: string
  summary: string
  steps: ChallengeStep[]
}
