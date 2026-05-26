import { createRng, randomInRange } from '../rng'
import {
  createSteeringAccumulator,
  resetSteeringAccumulator,
  accumulateNeighbor,
  resolveSteering,
  type SteeringAccumulator,
  type SteeringWeights,
} from '../physics/boidsSteering'
import { createSpatialGrid, type SpatialGrid } from '../physics/spatialGrid'
import type { ParamValues, ParticleBuffers, SimContext, SimMode } from '../types'

/**
 * Boids / flocking (Reynolds 1987) — an emergent-behaviour mode. Each boid steers by
 * three local rules over its perceived neighbours: separation (avoid crowding),
 * alignment (match heading), and cohesion (steer toward the group centre). Simple local
 * rules produce coherent moving flocks — the canonical local-rules→global-pattern demo.
 *
 * CPU reference using the shared spatial grid (cell size = perception radius) so the
 * neighbour sum is ~O(N). The defining constraint is *constant cruise speed*, not energy
 * conservation: each step the steering force is clamped to `maxForce` and the resulting
 * speed is clamped into `[minSpeed, maxSpeed]`. Integration is semi-implicit Euler
 * (velocity updated first, then position follows the new velocity).
 *
 * Boundaries use a *soft turn-at-wall* steering — as a boid nears a wall it gets an
 * inward acceleration toward the box centre — rather than a hard velocity flip. In a
 * contained lab view this keeps the flock framed while reading as smooth banking turns
 * instead of collisions, which is the point of the mode.
 */
export const boidsSchema = {
  particleCount: { type: 'number', label: 'Boid Count', default: 1200, min: 50, max: 20000, step: 10, group: 'scene' },
  perceptionRadius: { type: 'number', label: 'Perception Radius', default: 0.7, min: 0.2, max: 2, step: 0.05 },
  separationRadius: { type: 'number', label: 'Separation Radius', default: 0.3, min: 0.05, max: 1, step: 0.05 },
  separationWeight: { type: 'number', label: 'Separation', default: 1.6, min: 0, max: 5, step: 0.1 },
  alignmentWeight: { type: 'number', label: 'Alignment', default: 1.2, min: 0, max: 5, step: 0.1 },
  cohesionWeight: { type: 'number', label: 'Cohesion', default: 0.9, min: 0, max: 5, step: 0.1 },
  maxSpeed: { type: 'number', label: 'Max Speed', default: 1.6, min: 0.2, max: 5, step: 0.1 },
  maxForce: { type: 'number', label: 'Max Force', default: 3, min: 0.2, max: 12, step: 0.1 },
  containerSize: { type: 'number', label: 'Container Size', default: 6, min: 2, max: 12, step: 0.5, group: 'scene' },
  particleRadius: { type: 'number', label: 'Boid Size', default: 0.04, min: 0.02, max: 0.12, step: 0.01, group: 'scene' },
} as const

type Params = ParamValues<typeof boidsSchema>

/**
 * Cruise floor as a fraction of `maxSpeed`. Boids never stall (a stalled boid looks dead
 * and breaks the flock), so each step the speed is clamped into `[minSpeed, maxSpeed]`.
 */
export const MIN_SPEED_FRACTION = 0.5

/**
 * The boids mode plus a test-only steering probe. The probe is not part of the `SimMode`
 * contract (the app never calls it); it exists so the grid==brute-force invariant test
 * can compare the broadphase against an O(N²) reference without re-deriving the kernel.
 */
export interface BoidsMode extends SimMode<typeof boidsSchema> {
  /** Flat xyz-interleaved flock steering (no wall turn) for every boid, via the grid. */
  debugComputeSteering(): Float64Array
}

/**
 * Fraction of the half-bound at which wall-turn steering begins, and the strength of the
 * inward pull at the wall (in units of `maxForce`). Beginning the turn before the wall —
 * and ramping it up toward the boundary — produces a smooth bank rather than a bounce.
 */
const WALL_MARGIN_FRACTION = 0.85
const WALL_TURN_STRENGTH = 1.5

export function createBoidsMode(): BoidsMode {
  let count = 0
  let radius = 0
  let perceptionRadius = 0.7
  let separationRadius = 0.3
  let weights: SteeringWeights = { separation: 1.6, alignment: 1.2, cohesion: 0.9 }
  let maxSpeed = 1.6
  let minSpeed = 0.8
  let maxForce = 3
  let halfBound = 0
  let wallMargin = 0
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  let grid: SpatialGrid | null = null

  // Scratch shared with the grid neighbour callback (no per-frame closure/allocation).
  const acc: SteeringAccumulator = createSteeringAccumulator()
  const steer: [number, number, number] = [0, 0, 0]
  let probe = 0

  function init(ctx: SimContext<typeof boidsSchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    radius = p.particleRadius
    perceptionRadius = p.perceptionRadius
    separationRadius = p.separationRadius
    weights = { separation: p.separationWeight, alignment: p.alignmentWeight, cohesion: p.cohesionWeight }
    maxSpeed = p.maxSpeed
    minSpeed = maxSpeed * MIN_SPEED_FRACTION
    maxForce = p.maxForce
    halfBound = p.containerSize / 2 - radius
    wallMargin = halfBound * WALL_MARGIN_FRACTION

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
    // Cell size = perception radius, so every perceived neighbour falls in an adjacent
    // cell (the grid==brute-force invariant — see boids.test.ts).
    grid = createSpatialGrid(perceptionRadius)

    const rng = createRng(ctx.seed)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      positions[o] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 1] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 2] = randomInRange(rng, -halfBound, halfBound)
      // Random heading at cruise speed so the flock is moving from frame one.
      const speed = randomInRange(rng, minSpeed, maxSpeed)
      const phi = rng() * Math.PI * 2
      const cosTheta = 2 * rng() - 1
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
      velocities[o] = speed * sinTheta * Math.cos(phi)
      velocities[o + 1] = speed * sinTheta * Math.sin(phi)
      velocities[o + 2] = speed * cosTheta
    }
  }

  /** Fold one neighbour candidate into the steering accumulator for `probe`. */
  function onNeighbor(other: number): void {
    const po = probe * 3
    const oo = other * 3
    accumulateNeighbor(
      acc,
      velocities[oo],
      velocities[oo + 1],
      velocities[oo + 2],
      positions[oo] - positions[po],
      positions[oo + 1] - positions[po + 1],
      positions[oo + 2] - positions[po + 2],
      separationRadius,
      perceptionRadius,
    )
  }

  /** Rebuild the neighbour grid from current positions. */
  function rebuildGrid(): void {
    if (!grid) return
    grid.clear()
    for (let i = 0; i < count; i++) grid.insert(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
  }

  /**
   * Compute the flocking steering for boid `i` into `steer` via the grid neighbour scan.
   * Wall-turn steering is applied separately in `step` so this returns exactly the three
   * Reynolds rules (which lets the test compare it against the brute-force kernel).
   */
  function computeFlockSteering(i: number): void {
    const o = i * 3
    probe = i
    resetSteeringAccumulator(acc)
    grid!.forEachNeighbor(i, positions[o], positions[o + 1], positions[o + 2], onNeighbor)
    resolveSteering(acc, velocities[o], velocities[o + 1], velocities[o + 2], maxSpeed, maxForce, weights, steer)
  }

  /**
   * Add an inward turn-at-wall acceleration on one axis: zero until the boid passes the
   * margin, then ramping linearly to `WALL_TURN_STRENGTH · maxForce` at the wall. Returns
   * the acceleration contribution for that axis (sign points back toward centre).
   */
  function wallTurn(coord: number): number {
    if (coord > wallMargin) {
      const t = (coord - wallMargin) / (halfBound - wallMargin)
      return -t * WALL_TURN_STRENGTH * maxForce
    }
    if (coord < -wallMargin) {
      const t = (-coord - wallMargin) / (halfBound - wallMargin)
      return t * WALL_TURN_STRENGTH * maxForce
    }
    return 0
  }

  function step(dt: number): void {
    if (!grid) return
    rebuildGrid()

    for (let i = 0; i < count; i++) {
      const o = i * 3
      computeFlockSteering(i)

      // Total acceleration = flock steering + soft inward wall turn.
      const ax = steer[0] + wallTurn(positions[o])
      const ay = steer[1] + wallTurn(positions[o + 1])
      const az = steer[2] + wallTurn(positions[o + 2])

      // Semi-implicit Euler: integrate velocity, then clamp speed into the cruise band.
      let vx = velocities[o] + ax * dt
      let vy = velocities[o + 1] + ay * dt
      let vz = velocities[o + 2] + az * dt

      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (speed > maxSpeed) {
        const s = maxSpeed / speed
        vx *= s
        vy *= s
        vz *= s
      } else if (speed < minSpeed) {
        // Below the floor: rescale up to minSpeed, or pick a deterministic axis if a boid
        // ever reaches exactly zero (no RNG in the hot loop keeps the step deterministic).
        if (speed > 0) {
          const s = minSpeed / speed
          vx *= s
          vy *= s
          vz *= s
        } else {
          vx = minSpeed
        }
      }

      velocities[o] = vx
      velocities[o + 1] = vy
      velocities[o + 2] = vz
      positions[o] += vx * dt
      positions[o + 1] += vy * dt
      positions[o + 2] += vz * dt
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
    let keSum = 0 // Σ v² with unit mass.
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const speedSq = velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
      speedSum += Math.sqrt(speedSq)
      keSum += speedSq
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * keSum,
      // Boids speeds cluster near maxSpeed (not Maxwell–Boltzmann), so no histogram.
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    grid = null
    count = 0
  }

  /**
   * Test-only: compute the flock steering (the three Reynolds rules, no wall turn) for
   * every boid via the grid path and return it flat (xyz-interleaved). Lets the invariant
   * test assert the grid broadphase yields the same steering as brute-force O(N²).
   */
  function debugComputeSteering(): Float64Array {
    rebuildGrid()
    const out = new Float64Array(count * 3)
    for (let i = 0; i < count; i++) {
      computeFlockSteering(i)
      out[i * 3] = steer[0]
      out[i * 3 + 1] = steer[1]
      out[i * 3 + 2] = steer[2]
    }
    return out
  }

  return {
    id: 'boids',
    label: 'Boids / Flocking',
    backend: 'cpu',
    paramSchema: boidsSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
    debugComputeSteering,
  }
}
