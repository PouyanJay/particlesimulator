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

/**
 * Which section of the control panel a parameter belongs to. `scene` = universal setup
 * shared across modes (count, container size, display size); `dynamics` (default) = the
 * mode's own physics. Lets the panel group params consistently without per-mode UI code.
 */
export type ParamGroup = 'scene' | 'dynamics'

export interface NumberParam {
  type: 'number'
  label: string
  default: number
  min: number
  max: number
  step?: number
  /** Optional unit shown in the UI (e.g. "m/s"). */
  unit?: string
  /** Control-panel section (defaults to 'dynamics'). */
  group?: ParamGroup
}

export interface BooleanParam {
  type: 'boolean'
  label: string
  default: boolean
  /** Control-panel section (defaults to 'dynamics'). */
  group?: ParamGroup
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
  /** Optional xyz-interleaved velocities, length 3 * count (drives color-by-speed). */
  velocities?: Float32Array
  /** Optional per-particle type index, length count (drives categorical color-by-type). */
  types?: Uint8Array
  /** Optional rgb colors, xyz-interleaved, length 3 * count. */
  colors?: Float32Array
  /**
   * Optional spring/connection edges as node-index pairs (i, j), length 2 * edgeCount.
   * Modes with a connected structure (spring-mass, cloth, lattice) populate it so the render
   * layer can draw line segments between particles; particle-only modes leave it undefined.
   */
  edges?: Uint32Array
  /**
   * Optional per-body orientation quaternions (xyzw-interleaved, length 4 * count). Rigid-body
   * modes populate it so the render layer can draw *oriented* shapes; orientation-free particle
   * modes leave it undefined (rendered upright).
   */
  orientations?: Float32Array
  /**
   * Optional per-body shape index, length count (see `ShapeType`). Lets a single mode mix
   * shapes (e.g. boxes and spheres in the rigid-body sandbox); undefined ⇒ all rendered as the
   * default sphere of `radius`.
   */
  shapeTypes?: Uint8Array
  /**
   * Optional per-body half-extents (xyz-interleaved, length 3 * count). A sphere uses [x] as its
   * radius; a box uses (x, y, z) as its half-sides. Undefined ⇒ uniform `radius` for every body.
   */
  halfExtents?: Float32Array
  /** Particle render radius in world units (uniform fallback when `halfExtents` is absent). */
  radius: number
}

/** Render shape for a body in `ParticleBuffers.shapeTypes`. */
export enum ShapeType {
  Sphere = 0,
  Box = 1,
}

/** Measured quantities surfaced to charts and readouts. Extended per mode over time. */
export interface Telemetry {
  particleCount: number
  averageSpeed: number
  kineticEnergy: number
  /**
   * Optional per-particle speeds for the live speed histogram (e.g. Maxwell–Boltzmann).
   * Modes with a meaningful speed distribution populate it; others leave it undefined.
   */
  speedSamples?: Float32Array
  /**
   * Total momentum vector p = Σ m·v (xyz). Reported by the physical modes (gases, N-body)
   * as a bulk readout; left undefined where momentum isn't meaningful (e.g. damped/steered
   * modes). Note: a walled box is not momentum-conserving — the walls impart impulse.
   */
  momentum?: [number, number, number]
  /**
   * Kinetic-theory temperature T = m·⟨v²⟩ / 3 (equipartition, k_B = 1). Thermalised gases only.
   */
  temperature?: number
  /**
   * Pressure = wall impulse per unit area, time-averaged over the interval since the last
   * sample (reduced units). Walled gases only. For an ideal gas this satisfies P·V = N·k_B·T.
   */
  pressure?: number
  /**
   * Volume of the reflecting box (side³), reported alongside pressure so the equation panel
   * can show P·V = N·k_B·T live from telemetry alone. Same box the pressure is measured on.
   */
  volume?: number
  /**
   * True when total kinetic energy is not conserved this run (inelastic restitution, or an
   * external force such as gravity) — flags that conservation readouts will drift.
   *
   * All telemetry values are in **dimensionless reduced units** (k_B = 1, unit particle mass);
   * the lab models no specific substance, so quantities are pure numbers (see the UI note).
   */
  inelastic?: boolean
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
