/**
 * Core contracts for the simulation layer.
 *
 * `sim-core` is pure TypeScript — no React, no three.js. Every simulation implements
 * the `SimMode` plugin contract so that adding a mode requires zero changes to the
 * app shell or render layer (that seam is the architectural test — see CLAUDE.md).
 */

// ---------------------------------------------------------------------------
// Parameter schema — describes a mode's tunable parameters. Drives the control
// panel (Leva), presets, and URL-encoded state from a single declaration.
// ---------------------------------------------------------------------------

export interface NumberParam {
  type: 'number'
  label: string
  default: number
  min: number
  max: number
  step?: number
  /** Optional unit shown in the UI (e.g. "m/s"). */
  unit?: string
}

export interface BooleanParam {
  type: 'boolean'
  label: string
  default: boolean
}

export type ParamDef = NumberParam | BooleanParam

export type ParamSchema = Record<string, ParamDef>

/**
 * The resolved values for a schema (number params → number, boolean params → boolean).
 * The three-way conditional degrades gracefully to `number | boolean` for the erased
 * `ParamSchema` (used at the registry/driver boundary), while concrete schemas resolve
 * each key precisely.
 */
export type ParamValue = number | boolean
export type ParamValues<S extends ParamSchema> = {
  [K in keyof S]: S[K] extends NumberParam ? number : S[K] extends BooleanParam ? boolean : ParamValue
}

// ---------------------------------------------------------------------------
// Simulation I/O
// ---------------------------------------------------------------------------

/** Everything a mode needs to (re)initialise deterministically. */
export interface SimContext<S extends ParamSchema = ParamSchema> {
  /** Seed for all RNG so a scenario replays identically. */
  seed: number
  params: ParamValues<S>
}

/** GPU/render-facing particle data. Positions are xyz-interleaved, length 3 * count. */
export interface ParticleBuffers {
  count: number
  positions: Float32Array
  /** Optional rgb colors, xyz-interleaved, length 3 * count. */
  colors?: Float32Array
  /** Particle render radius in world units (uniform for now). */
  radius: number
}

/** Measured quantities surfaced to charts and readouts. Extended per mode over time. */
export interface Telemetry {
  particleCount: number
  averageSpeed: number
  kineticEnergy: number
}

export type SimBackend = 'cpu' | 'rapier' | 'webgpu-compute'

/**
 * A registered simulation. Implementations hold their own mutable state and are
 * driven by the render layer: `init` once, `step` per fixed timestep, `getBuffers`
 * each frame for rendering, `getTelemetry` for charts, `dispose` on teardown.
 */
export interface SimMode<S extends ParamSchema = ParamSchema> {
  readonly id: string
  readonly label: string
  readonly backend: SimBackend
  readonly paramSchema: S
  init(ctx: SimContext<S>): void
  step(dt: number): void
  getTelemetry(): Telemetry
  getBuffers(): ParticleBuffers
  dispose(): void
}

/**
 * A zero-arg factory that constructs a fresh mode instance. Must be cheap and
 * side-effect-free before `init` is called — the registry constructs a throwaway
 * probe to read `id`/`label` for listings.
 */
export type SimModeFactory = () => SimMode
