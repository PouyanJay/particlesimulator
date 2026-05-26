import { computeCoulombAccelerations } from '../physics/coulomb'
import { velocityVerlet, type AccelFn, type Integrator } from '../integrators/integrators'
import { reflectInBox } from '../physics/environment'
import { countParam, containerParam, displaySizeParam } from '../params/common'
import { createRng, randomInRange } from '../rng'
import { totalMomentum } from '../measure/conservedQuantities'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

/**
 * Electrostatics — every charge exerts a Coulomb force on every other (all-pairs, equal unit
 * mass). Each particle carries a fixed signed charge (≈half +, half −) assigned from the seed,
 * so like charges repel and opposite charges attract: oppositely-charged pairs draw together
 * into dipoles while like charges spread out, settling toward low-energy equilibrium clusters.
 * Integrated with velocity Verlet (symplectic — bounded energy drift) and a softened 1/r²
 * force; particles reflect off the container so the view stays framed.
 *
 * The all-pairs sum scales with N, so the Coulomb constant is divided by the charge count
 * inside the accel field (a mean-field normalization, like the GPU N-body mode): the strength
 * knob then means the same thing at any count and the default scene never blows up.
 *
 * All-pairs is O(N²), so the count is capped to the low thousands on CPU. Colored by charge
 * sign via the per-particle `types` buffer (0 = negative, 1 = positive).
 */
export const electrostaticsSchema = {
  particleCount: countParam({ label: 'Charge Count', default: 400, min: 50, max: 3000 }),
  // Coulomb strength k. Divided by the charge count in the kernel (mean-field), so it's
  // count-independent; the default is tuned for a stable, lively scene at any N.
  coulombConstant: { type: 'number', label: 'Coulomb Constant', default: 4, min: 0.5, max: 20, step: 0.5 },
  chargeMagnitude: { type: 'number', label: 'Charge Magnitude', default: 1, min: 0.2, max: 3, step: 0.1 },
  softening: { type: 'number', label: 'Softening', default: 0.2, min: 0.05, max: 1, step: 0.01 },
  initialSpeed: { type: 'number', label: 'Initial Speed', default: 0.3, min: 0, max: 2, step: 0.1 },
  containerSize: containerParam({ label: 'Bounds', default: 8, min: 4, max: 16, step: 1 }),
  particleRadius: displaySizeParam({ label: 'Charge Size', default: 0.05, min: 0.02, max: 0.12 }),
} as const

type Params = ParamValues<typeof electrostaticsSchema>

export function createElectrostaticsMode(): SimMode<typeof electrostaticsSchema> {
  let count = 0
  let radius = 0
  let coulombK = 0
  let softeningSq = 0
  let halfBound = 0
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let charges = new Float64Array(0)
  let types = new Uint8Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)
  let integrator: Integrator | null = null

  // Coulomb acceleration field for the integrator (reads current closure params).
  const accel: AccelFn = (pos, out) =>
    computeCoulombAccelerations(pos, charges, count, coulombK, softeningSq, out)

  function init(ctx: SimContext<typeof electrostaticsSchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    radius = p.particleRadius
    // Mean-field normalization: divide by count so the strength knob is count-independent.
    coulombK = count > 0 ? p.coulombConstant / count : 0
    softeningSq = p.softening * p.softening
    halfBound = p.containerSize / 2 - radius

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    charges = new Float64Array(count)
    types = new Uint8Array(count)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
    integrator = velocityVerlet(count * 3)

    // Seed a cloud of charges in the central third of the box with small random velocities,
    // each a + or − charge by a coin flip — so the Coulomb forces immediately sort them.
    const rng = createRng(ctx.seed)
    const spread = p.containerSize * 0.3
    for (let i = 0; i < count; i++) {
      const o = i * 3
      positions[o] = randomInRange(rng, -spread, spread)
      positions[o + 1] = randomInRange(rng, -spread, spread)
      positions[o + 2] = randomInRange(rng, -spread, spread)
      velocities[o] = randomInRange(rng, -p.initialSpeed, p.initialSpeed)
      velocities[o + 1] = randomInRange(rng, -p.initialSpeed, p.initialSpeed)
      velocities[o + 2] = randomInRange(rng, -p.initialSpeed, p.initialSpeed)
      const positive = rng() < 0.5
      types[i] = positive ? 1 : 0
      charges[i] = positive ? p.chargeMagnitude : -p.chargeMagnitude
    }
  }

  function step(dt: number): void {
    if (!integrator) return
    integrator.step(positions, velocities, accel, dt)
    // Reflect off the container walls so the system stays framed (shared helper).
    reflectInBox(positions, velocities, count, halfBound)
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < renderPositions.length; i++) {
      renderPositions[i] = positions[i]
      renderVelocities[i] = velocities[i]
    }
    // `types` (charge sign) drives the categorical color-by-type path in the renderer.
    return { count, positions: renderPositions, velocities: renderVelocities, types, radius }
  }

  function getTelemetry(): Telemetry {
    let speedSum = 0
    let keSum = 0
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const speedSq = velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
      speedSum += Math.sqrt(speedSq)
      keSum += speedSq
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * keSum, // unit mass
      momentum: totalMomentum(velocities, count), // Coulomb is internal; walls perturb it
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    charges = new Float64Array(0)
    types = new Uint8Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    integrator = null
    count = 0
  }

  return {
    id: 'electrostatics',
    label: 'Electrostatics',
    backend: 'cpu',
    paramSchema: electrostaticsSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
