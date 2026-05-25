import { createRng, type Rng } from '../rng'
import { createLennardJonesField, type LennardJonesField } from '../physics/lennardJonesField'
import { velocityVerlet, type AccelFn, type Integrator } from '../integrators/integrators'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

/**
 * Molecular dynamics — a Lennard-Jones gas in reduced units (mass = 1). Atoms interact
 * through the force-shifted LJ pair potential (see `lennardJonesForce`), integrated with
 * velocity Verlet (symplectic, energy-bounded — the right choice for an energy-sensitive
 * conservative system) and reflected off a walled box. A uniform spatial grid with cell
 * size = the cutoff radius keeps the neighbour cost ~O(N); the grid sum is verified equal
 * to brute-force O(N²) in `lennardJonesField.test.ts`.
 *
 * This is the flagship vehicle for the Maxwell–Boltzmann histogram: atoms start on a
 * non-overlapping cubic lattice with seeded thermal velocities (net momentum removed), and
 * the LJ collisions keep the speeds Maxwell–Boltzmann distributed, which
 * `getTelemetry().speedSamples` feeds to the live histogram.
 *
 * Reduced LJ units: lengths in σ, energies in ε, mass = 1. The driver's render-rate dt is
 * far too coarse for stable Verlet at this scale, so `step` substeps internally at a fixed
 * small MD timestep — the integrator never sees the raw frame dt.
 */
export const molecularDynamicsSchema = {
  particleCount: { type: 'number', label: 'Atom Count', default: 216, min: 8, max: 4000, step: 1 },
  temperature: { type: 'number', label: 'Temperature', default: 1.2, min: 0.1, max: 5, step: 0.1, unit: 'ε/k_B' },
  epsilon: { type: 'number', label: 'Well Depth (ε)', default: 1.0, min: 0.1, max: 5, step: 0.1, unit: 'ε' },
  sigma: { type: 'number', label: 'Atom Diameter (σ)', default: 1.0, min: 0.5, max: 2, step: 0.1, unit: 'σ' },
  cutoff: { type: 'number', label: 'Cutoff', default: 2.5, min: 1.5, max: 4, step: 0.1, unit: 'σ' },
  containerSize: { type: 'number', label: 'Box Size', default: 14, min: 6, max: 30, step: 1, unit: 'σ' },
  particleRadius: { type: 'number', label: 'Atom Size', default: 0.4, min: 0.1, max: 1, step: 0.05, unit: 'σ' },
} as const

type Params = ParamValues<typeof molecularDynamicsSchema>

const PARTICLE_MASS = 1 // reduced units: equal unit mass for every atom.

/**
 * Fixed internal MD timestep (reduced units). LJ forces near contact are stiff; the
 * characteristic vibration time at the well is τ ≈ σ·√(m/ε) ≈ 1, so a step of 0.005 keeps
 * velocity Verlet well inside its stability window and gives bounded energy drift. `step`
 * splits the incoming frame dt into ceil(dt / MD_TIMESTEP) equal sub-steps.
 */
const MD_TIMESTEP = 0.005

/** Smallest non-overlapping pair separation: the LJ potential minimum r = 2^(1/6)·σ. */
const TWO_POW_ONE_SIXTH = Math.pow(2, 1 / 6)

export function createMolecularDynamicsMode(): SimMode<typeof molecularDynamicsSchema> {
  // Internal state in Float64 for accuracy; a Float32 view is produced for rendering.
  let count = 0
  let radius = 0
  let halfBound = 0 // half box size minus radius — the clamp for atom centres.
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  let field: LennardJonesField | null = null
  let integrator: Integrator | null = null

  // Acceleration field for the integrator (delegates to the grid-accelerated LJ kernel).
  const accel: AccelFn = (pos, out) => field?.computeAccelerations(pos, count, out)

  function init(ctx: SimContext<typeof molecularDynamicsSchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    radius = p.particleRadius
    halfBound = p.containerSize / 2 - radius
    const cutoff = p.cutoff * p.sigma // cutoff in absolute length units.

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
    integrator = velocityVerlet(count * 3)
    field = createLennardJonesField(p.epsilon, p.sigma, cutoff)

    const rng = createRng(ctx.seed)
    seedCubicLattice(p.sigma)
    seedThermalVelocities(rng, p.temperature)
  }

  /**
   * Place atoms on a centred simple-cubic lattice with spacing ≥ 2^(1/6)·σ so no pair
   * starts inside the repulsive wall (LJ blows up on overlap). Atoms sit at *cell centres* of
   * a perSide³ grid filling the usable span, so the outermost atoms are inset half a cell
   * from the walls (none start touching a wall — which would trip an immediate reflection).
   * When the box is too small to fit the lattice at the no-overlap minimum, the minimum wins
   * and the lattice is centred (it may extend toward the walls, but never overlaps).
   */
  function seedCubicLattice(sigma: number): void {
    const perSide = Math.ceil(Math.cbrt(count))
    const minSpacing = TWO_POW_ONE_SIXTH * sigma
    const usable = 2 * halfBound
    // Cell-centred fit: perSide cells across the usable span ⇒ spacing = usable / perSide.
    const fitSpacing = perSide > 0 ? usable / perSide : 0
    const spacing = Math.max(minSpacing, fitSpacing)
    const offset = ((perSide - 1) * spacing) / 2 // centre the lattice on the origin.
    for (let i = 0; i < count; i++) {
      const ix = i % perSide
      const iy = Math.floor(i / perSide) % perSide
      const iz = Math.floor(i / (perSide * perSide))
      const o = i * 3
      positions[o] = ix * spacing - offset
      positions[o + 1] = iy * spacing - offset
      positions[o + 2] = iz * spacing - offset
    }
  }

  /**
   * Draw per-component velocities from a (seeded) Gaussian whose width matches the target
   * temperature via equipartition (⟨½mv_x²⟩ = ½k_BT ⇒ σ_v = √(T/m) in reduced units, k_B = 1),
   * then subtract the centre-of-mass velocity so total momentum is exactly ~0 — which makes
   * momentum conservation clean and testable and keeps the gas from drifting bodily.
   */
  function seedThermalVelocities(rng: Rng, temperature: number): void {
    if (count === 0) return
    const stdDev = Math.sqrt(temperature / PARTICLE_MASS)
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    for (let i = 0; i < count; i++) {
      const o = i * 3
      velocities[o] = stdDev * gaussian(rng)
      velocities[o + 1] = stdDev * gaussian(rng)
      velocities[o + 2] = stdDev * gaussian(rng)
      sumX += velocities[o]
      sumY += velocities[o + 1]
      sumZ += velocities[o + 2]
    }
    const meanX = sumX / count
    const meanY = sumY / count
    const meanZ = sumZ / count
    for (let i = 0; i < count; i++) {
      const o = i * 3
      velocities[o] -= meanX
      velocities[o + 1] -= meanY
      velocities[o + 2] -= meanZ
    }
  }

  function step(dt: number): void {
    if (!integrator || dt <= 0) return
    // Substep at the fixed MD timestep: velocity Verlet is only stable for the stiff LJ
    // force at small dt, and substepping keeps energy drift bounded regardless of the
    // (coarse, render-rate) frame dt the driver supplies.
    const subSteps = Math.max(1, Math.ceil(dt / MD_TIMESTEP))
    const subDt = dt / subSteps
    for (let s = 0; s < subSteps; s++) {
      integrator.step(positions, velocities, accel, subDt)
      reflectOffWalls()
    }
  }

  /** Clamp centres to the box and flip the outward velocity component (energy-neutral). */
  function reflectOffWalls(): void {
    for (let i = 0; i < count; i++) {
      const o = i * 3
      for (let axis = 0; axis < 3; axis++) {
        const k = o + axis
        if (positions[k] > halfBound && velocities[k] > 0) {
          positions[k] = halfBound
          velocities[k] = -velocities[k]
        } else if (positions[k] < -halfBound && velocities[k] < 0) {
          positions[k] = -halfBound
          velocities[k] = -velocities[k]
        }
      }
    }
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < renderPositions.length; i++) {
      renderPositions[i] = positions[i]
      renderVelocities[i] = velocities[i]
    }
    return { count, positions: renderPositions, velocities: renderVelocities, radius }
  }

  function getTelemetry(): Telemetry {
    let speedSum = 0
    let keSum = 0
    const speedSamples = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const speedSq = velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
      const speed = Math.sqrt(speedSq)
      speedSamples[i] = speed
      speedSum += speed
      keSum += speedSq
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * PARTICLE_MASS * keSum,
      speedSamples,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    field = null
    integrator = null
    count = 0
  }

  return {
    id: 'molecular-dynamics',
    label: 'Lennard-Jones Gas',
    backend: 'cpu',
    paramSchema: molecularDynamicsSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}

/**
 * A standard-normal sample via the Box–Muller transform from the seeded RNG. Gaussian
 * component velocities give a Maxwell–Boltzmann speed distribution immediately at t = 0;
 * the LJ dynamics then keep it in equilibrium rather than having to create it from scratch.
 */
function gaussian(rng: Rng): number {
  // Guard the log against u1 = 0 (rng() is in [0,1)); the result is still uniform.
  const u1 = 1 - rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
