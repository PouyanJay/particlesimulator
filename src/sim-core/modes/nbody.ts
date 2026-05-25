import { createRng, randomInRange } from '../rng'
import { computeGravityAccelerations } from '../physics/gravity'
import { velocityVerlet, type AccelFn, type Integrator } from '../integrators/integrators'
import type { ParamValues, ParticleBuffers, SimContext, SimMode } from '../types'

/**
 * N-body gravity — every body attracts every other (all-pairs, equal unit mass). Starts
 * as a rotating disk; gravity + spin evolve it into clusters and spiral structure.
 * Integrated with velocity Verlet (symplectic — stable orbits, bounded energy drift)
 * and a softened 1/r² force; bodies reflect off the container so the view stays framed.
 *
 * All-pairs is O(N²), so the count is capped to the low thousands on CPU; Barnes-Hut /
 * GPU come later. Colored by speed (no per-particle type).
 */
export const nbodySchema = {
  particleCount: { type: 'number', label: 'Bodies', default: 600, min: 50, max: 3000, step: 10 },
  gravity: { type: 'number', label: 'Gravity Strength', default: 0.02, min: 0.001, max: 0.2, step: 0.001 },
  softening: { type: 'number', label: 'Softening', default: 0.15, min: 0.02, max: 1, step: 0.01, unit: 'm' },
  rotation: { type: 'number', label: 'Initial Spin', default: 0.6, min: 0, max: 2, step: 0.1 },
  containerSize: { type: 'number', label: 'Bounds', default: 8, min: 4, max: 16, step: 1, unit: 'm' },
  particleRadius: { type: 'number', label: 'Body Size', default: 0.04, min: 0.02, max: 0.12, step: 0.01, unit: 'm' },
} as const

type Params = ParamValues<typeof nbodySchema>

export function createNbodyMode(): SimMode<typeof nbodySchema> {
  let count = 0
  let radius = 0
  let gravityG = 0.02
  let softeningSq = 0.0225
  let halfBound = 0
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)
  let integrator: Integrator | null = null

  // Gravitational acceleration field for the integrator (reads current closure params).
  const accel: AccelFn = (pos, out) => computeGravityAccelerations(pos, count, gravityG, softeningSq, out)

  function init(ctx: SimContext<typeof nbodySchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    radius = p.particleRadius
    gravityG = p.gravity
    softeningSq = p.softening * p.softening
    halfBound = p.containerSize / 2 - radius

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
    integrator = velocityVerlet(count * 3)

    const rng = createRng(ctx.seed)
    // A flattened disk (y compressed), spun about the Y axis (rigid rotation v = ω × r).
    const r = p.containerSize * 0.25
    const w = p.rotation
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const x = randomInRange(rng, -r, r)
      const y = randomInRange(rng, -r * 0.3, r * 0.3)
      const z = randomInRange(rng, -r, r)
      positions[o] = x
      positions[o + 1] = y
      positions[o + 2] = z
      velocities[o] = w * z
      velocities[o + 1] = 0
      velocities[o + 2] = -w * x
    }
  }

  function step(dt: number): void {
    if (!integrator) return
    integrator.step(positions, velocities, accel, dt)
    // Reflect off the container walls so the cluster stays framed.
    for (let i = 0; i < count; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const k = i * 3 + axis
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

  function getTelemetry() {
    let speedSum = 0
    for (let i = 0; i < count; i++) {
      const o = i * 3
      speedSum += Math.sqrt(velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2)
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * speedSum, // approx (unit mass); detailed energy is a Phase 3 readout
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    integrator = null
    count = 0
  }

  return {
    id: 'nbody',
    label: 'N-Body Gravity',
    backend: 'cpu',
    paramSchema: nbodySchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
