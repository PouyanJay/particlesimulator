import { createRng, randomInRange, type Rng } from '../rng'
import { resolveElasticCollision } from '../physics/elasticCollision'
import type { ParamValues, ParticleBuffers, SimContext, SimMode } from '../types'
import type { Vec3 } from '../math/vec3'

/**
 * Elastic-collision gas — the reference CPU simulation and the first registered
 * `SimMode`. Spheres of equal mass bounce inside a cube, colliding elastically with
 * each other and the walls. This is the deterministic CPU reference the GPU port in
 * Phase 2 will be validated against (see CLAUDE.md / simulation-modes.md).
 *
 * Neighbour search here is brute-force O(N²): correct and clear, suitable for the
 * modest counts the CPU path targets. Scaling is the GPU backend's job later.
 */
export const elasticGasSchema = {
  particleCount: { type: 'number', label: 'Particle Count', default: 200, min: 10, max: 2000, step: 10 },
  particleRadius: { type: 'number', label: 'Particle Size', default: 0.08, min: 0.02, max: 0.2, step: 0.01, unit: 'm' },
  initialVelocity: { type: 'number', label: 'Initial Velocity', default: 1.0, min: 0.1, max: 5.0, step: 0.1, unit: 'm/s' },
  restitution: { type: 'number', label: 'Restitution', default: 1.0, min: 0.1, max: 1.0, step: 0.001 },
  containerSize: { type: 'number', label: 'Container Size', default: 2.5, min: 1, max: 6, step: 0.5, unit: 'm' },
  gravity: { type: 'boolean', label: 'Gravity', default: false },
} as const

type GasParams = ParamValues<typeof elasticGasSchema>

const GRAVITY = -9.81 // m/s² applied on the Y axis when enabled.
const PARTICLE_MASS = 1 // equal mass for all particles.

export function createElasticGasMode(): SimMode<typeof elasticGasSchema> {
  // Internal state in Float64 for accuracy; a Float32 view is produced for rendering.
  let count = 0
  let radius = 0
  let restitution = 1
  let halfBound = 0 // half container size minus radius — the clamp for particle centres.
  let gravityOn = false
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  function init(ctx: SimContext<typeof elasticGasSchema>): void {
    const params: GasParams = ctx.params
    count = params.particleCount
    radius = params.particleRadius
    restitution = params.restitution
    gravityOn = params.gravity
    halfBound = params.containerSize / 2 - radius

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)

    const rng = createRng(ctx.seed)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      positions[o] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 1] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 2] = randomInRange(rng, -halfBound, halfBound)
      const [vx, vy, vz] = randomVelocity(rng, params.initialVelocity)
      velocities[o] = vx
      velocities[o + 1] = vy
      velocities[o + 2] = vz
    }
  }

  function step(dt: number): void {
    if (gravityOn) {
      for (let i = 0; i < count; i++) velocities[i * 3 + 1] += GRAVITY * dt
    }
    // Note: with gravity on, the hard wall clamp in reflectOffWalls() truncates a
    // sub-step's penetration depth, so total mechanical energy dissipates at O(dt).
    // This is an accepted symplectic-Euler + hard-clamp artifact (energy never grows);
    // a position-reflection scheme would recover it if tighter conservation is needed.
    // Semi-implicit Euler integration (velocity already updated above).
    for (let i = 0; i < positions.length; i++) positions[i] += velocities[i] * dt
    reflectOffWalls()
    resolveCollisions()
  }

  /** Clamp centres to the container and flip the outward velocity component (× restitution). */
  function reflectOffWalls(): void {
    for (let i = 0; i < count; i++) {
      const o = i * 3
      for (let axis = 0; axis < 3; axis++) {
        const k = o + axis
        if (positions[k] > halfBound && velocities[k] > 0) {
          positions[k] = halfBound
          velocities[k] = -velocities[k] * restitution
        } else if (positions[k] < -halfBound && velocities[k] < 0) {
          positions[k] = -halfBound
          velocities[k] = -velocities[k] * restitution
        }
      }
    }
  }

  /**
   * Brute-force pairwise elastic collisions for overlapping, approaching particles.
   * Velocity-only resolution (no positional push-out): the "approaching" guard in the
   * kernel keeps this energy-neutral, but at high density particles can linger in
   * overlap. Harmless at current CPU-tier densities; revisit for the GPU port.
   */
  function resolveCollisions(): void {
    const contactDistSq = (2 * radius) * (2 * radius)
    for (let i = 0; i < count; i++) {
      const oi = i * 3
      for (let j = i + 1; j < count; j++) {
        const oj = j * 3
        const dx = positions[oj] - positions[oi]
        const dy = positions[oj + 1] - positions[oi + 1]
        const dz = positions[oj + 2] - positions[oi + 2]
        if (dx * dx + dy * dy + dz * dz >= contactDistSq) continue

        const pi: Vec3 = [positions[oi], positions[oi + 1], positions[oi + 2]]
        const pj: Vec3 = [positions[oj], positions[oj + 1], positions[oj + 2]]
        const vi: Vec3 = [velocities[oi], velocities[oi + 1], velocities[oi + 2]]
        const vj: Vec3 = [velocities[oj], velocities[oj + 1], velocities[oj + 2]]
        const [ni, nj] = resolveElasticCollision(pi, vi, PARTICLE_MASS, pj, vj, PARTICLE_MASS, restitution)
        velocities[oi] = ni[0]
        velocities[oi + 1] = ni[1]
        velocities[oi + 2] = ni[2]
        velocities[oj] = nj[0]
        velocities[oj + 1] = nj[1]
        velocities[oj + 2] = nj[2]
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
      kineticEnergy: 0.5 * PARTICLE_MASS * keSum,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    count = 0
  }

  return {
    id: 'elastic-gas',
    label: 'Elastic Gas',
    backend: 'cpu',
    paramSchema: elasticGasSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}

/** A random velocity: speed in [0.5, 1] × maxSpeed, uniformly distributed direction. */
function randomVelocity(rng: Rng, maxSpeed: number): [number, number, number] {
  const speed = (0.5 + 0.5 * rng()) * maxSpeed
  // Uniform direction on the sphere via spherical coordinates.
  const phi = rng() * Math.PI * 2
  const cosTheta = 2 * rng() - 1
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
  return [
    speed * sinTheta * Math.cos(phi),
    speed * sinTheta * Math.sin(phi),
    speed * cosTheta,
  ]
}
