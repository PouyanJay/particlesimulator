import { createRng, randomInRange, type Rng } from '../rng'
import { resolveElasticCollision } from '../physics/elasticCollision'
import { createSpatialGrid, type SpatialGrid } from '../physics/spatialGrid'
import { totalMomentum, temperature } from '../measure/conservedQuantities'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'
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
  particleCount: { type: 'number', label: 'Particle Count', default: 200, min: 10, max: 20000, step: 10 },
  particleRadius: { type: 'number', label: 'Particle Size', default: 0.08, min: 0.02, max: 0.2, step: 0.01, unit: 'm' },
  initialVelocity: { type: 'number', label: 'Initial Velocity', default: 1.0, min: 0.1, max: 5.0, step: 0.1, unit: 'm/s' },
  restitution: { type: 'number', label: 'Restitution', default: 1.0, min: 0.1, max: 1.0, step: 0.001 },
  containerSize: { type: 'number', label: 'Container Size', default: 2.5, min: 1, max: 6, step: 0.5, unit: 'm' },
  gravity: { type: 'boolean', label: 'Gravity', default: false },
} as const

type GasParams = ParamValues<typeof elasticGasSchema>

const GRAVITY = -9.81 // m/s² applied on the Y axis when enabled.
const PARTICLE_MASS = 1 // equal mass for all particles.

// Mechanical quantities are SI with unit particle mass (1 kg, so energy is in J, etc.).
// Temperature, however, is reduced/dimensionless: with k_B = 1 it is k_B·T expressed in the
// energy unit, not kelvin — a value of ~0.2–2 is a normal gas, not 0.2 K. (Using a real
// k_B = 1.38e-23 J/K with these unit-mass velocities would instead give absurd ~1e22 K.)
const UNITS = { speed: 'm/s', energy: 'J', temperature: 'reduced', pressure: 'Pa', momentum: 'kg·m/s' } as const

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

  // Pressure measurement: accumulate the impulse delivered to the walls and the simulated
  // time elapsed, both since the last telemetry read; pressure = impulse / (area · time).
  let wallArea = 0 // total area of the 6 reflecting faces (the box the centres bounce in).
  let wallImpulse = 0
  let simTimeAccum = 0

  // Collision broadphase. `probeIndex`/`contactDistSq` are scratch shared with the
  // grid neighbour callback so it allocates no per-frame closures.
  let grid: SpatialGrid | null = null
  let contactDistSq = 0
  let probeIndex = 0

  function init(ctx: SimContext<typeof elasticGasSchema>): void {
    const params: GasParams = ctx.params
    count = params.particleCount
    radius = params.particleRadius
    restitution = params.restitution
    gravityOn = params.gravity
    halfBound = params.containerSize / 2 - radius
    // The reflecting box has side 2·halfBound; its 6 faces are the area pressure acts on.
    wallArea = 6 * (2 * halfBound) * (2 * halfBound)
    wallImpulse = 0
    simTimeAccum = 0
    // Cell size = contact distance, so neighbours within 2·r fall in adjacent cells.
    grid = createSpatialGrid(2 * radius)

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
    simTimeAccum += dt
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
          // Impulse on the wall = m·Δv = m·|v_in|·(1 + restitution) (v_out = −e·v_in).
          wallImpulse += PARTICLE_MASS * velocities[k] * (1 + restitution)
          positions[k] = halfBound
          velocities[k] = -velocities[k] * restitution
        } else if (positions[k] < -halfBound && velocities[k] < 0) {
          wallImpulse += PARTICLE_MASS * -velocities[k] * (1 + restitution)
          positions[k] = -halfBound
          velocities[k] = -velocities[k] * restitution
        }
      }
    }
  }

  /**
   * Resolve `probeIndex` against one neighbour candidate supplied by the spatial grid.
   * Each pair is handled once (`other > probeIndex`) and re-checked against the exact
   * contact distance. Velocity-only resolution (no positional push-out): the kernel's
   * "approaching" guard keeps it energy-neutral, though dense overlaps can linger.
   */
  function onNeighbor(other: number): void {
    if (other <= probeIndex) return
    const oi = probeIndex * 3
    const oj = other * 3
    const dx = positions[oj] - positions[oi]
    const dy = positions[oj + 1] - positions[oi + 1]
    const dz = positions[oj + 2] - positions[oi + 2]
    if (dx * dx + dy * dy + dz * dz >= contactDistSq) return

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

  /**
   * Elastic collisions via a uniform spatial grid (cell size = contact distance), so the
   * broadphase is ~O(N) instead of O(N²). The grid finds every pair within the contact
   * distance (proven against brute force in spatialGrid.test.ts), so the resolved pair
   * set matches the naive all-pairs version.
   */
  function resolveCollisions(): void {
    if (!grid) return
    contactDistSq = (2 * radius) * (2 * radius)
    grid.clear()
    for (let i = 0; i < count; i++) {
      grid.insert(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    }
    for (let i = 0; i < count; i++) {
      probeIndex = i
      grid.forEachNeighbor(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], onNeighbor)
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
    // Time-averaged wall pressure over the interval since the last read, then reset the
    // window. (getTelemetry is sampled on an interval by the driver — see simDriver.)
    const pressure = simTimeAccum > 0 && wallArea > 0 ? wallImpulse / (wallArea * simTimeAccum) : 0
    wallImpulse = 0
    simTimeAccum = 0
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * PARTICLE_MASS * keSum,
      speedSamples,
      momentum: totalMomentum(velocities, count, PARTICLE_MASS),
      temperature: temperature(velocities, count, PARTICLE_MASS),
      pressure,
      // Elastic walls + elastic collisions conserve KE; restitution < 1 or gravity break it.
      inelastic: restitution < 1 || gravityOn,
      units: UNITS,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    grid = null
    count = 0
    wallImpulse = 0
    simTimeAccum = 0
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
