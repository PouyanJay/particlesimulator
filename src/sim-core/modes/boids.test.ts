import { describe, it, expect } from 'vitest'
import { createBoidsMode, boidsSchema, MIN_SPEED_FRACTION } from './boids'
import {
  createSteeringAccumulator,
  resetSteeringAccumulator,
  accumulateNeighbor,
  resolveSteering,
  type SteeringWeights,
} from '../physics/boidsSteering'
import { defaultParamValues } from '../paramSchema'
import type { ParamValues, SimContext } from '../types'

type Params = ParamValues<typeof boidsSchema>

function ctx(overrides: Partial<Params> = {}, seed = 1): SimContext<typeof boidsSchema> {
  return { seed, params: { ...defaultParamValues(boidsSchema), ...overrides } }
}

/** Mean of unit velocity vectors — the flocking "alignment order parameter" in [0, 1]. */
function alignmentOrder(velocities: Float32Array, count: number): number {
  let ux = 0
  let uy = 0
  let uz = 0
  for (let i = 0; i < count; i++) {
    const o = i * 3
    const speed = Math.hypot(velocities[o], velocities[o + 1], velocities[o + 2])
    if (speed === 0) continue
    ux += velocities[o] / speed
    uy += velocities[o + 1] / speed
    uz += velocities[o + 2] / speed
  }
  return Math.hypot(ux, uy, uz) / count
}

describe('boids mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createBoidsMode()
    expect(mode.id).toBe('boids')
    expect(mode.label).toBe('Boids / Flocking')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(boidsSchema)
  })

  it('initialises position and velocity buffers sized to the particle count', () => {
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 120 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(120)
    expect(b.positions.length).toBe(360)
    expect(b.velocities?.length).toBe(360)
  })

  it('supplies velocities so the render layer colors by speed', () => {
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 50 }))
    expect(mode.getBuffers().velocities).toBeDefined()
    expect(mode.getBuffers().types).toBeUndefined()
  })

  it('starts every boid inside the container', () => {
    const containerSize = 6
    const radius = 0.05
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 300, containerSize, particleRadius: radius }))
    const { positions } = mode.getBuffers()
    const bound = containerSize / 2 - radius
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-6)
    }
  })

  it('starts every boid cruising within [minSpeed, maxSpeed]', () => {
    const maxSpeed = 2
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 200, maxSpeed }))
    const { velocities } = mode.getBuffers()
    const minSpeed = maxSpeed * MIN_SPEED_FRACTION
    for (let i = 0; i < 200; i++) {
      const o = i * 3
      const speed = Math.hypot(velocities![o], velocities![o + 1], velocities![o + 2])
      expect(speed).toBeGreaterThanOrEqual(minSpeed - 1e-6)
      expect(speed).toBeLessThanOrEqual(maxSpeed + 1e-6)
    }
  })

  it('clamps every boid speed into [minSpeed, maxSpeed] after a step', () => {
    const maxSpeed = 2
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 400, maxSpeed }))
    const minSpeed = maxSpeed * MIN_SPEED_FRACTION
    for (let s = 0; s < 30; s++) mode.step(1 / 60)
    const { velocities } = mode.getBuffers()
    for (let i = 0; i < 400; i++) {
      const o = i * 3
      const speed = Math.hypot(velocities![o], velocities![o + 1], velocities![o + 2])
      expect(speed).toBeGreaterThanOrEqual(minSpeed - 1e-6)
      expect(speed).toBeLessThanOrEqual(maxSpeed + 1e-6)
    }
  })

  it('is deterministic: same seed yields identical state after N steps', () => {
    const a = createBoidsMode()
    const b = createBoidsMode()
    a.init(ctx({ particleCount: 150 }, 42))
    b.init(ctx({ particleCount: 150 }, 42))
    for (let i = 0; i < 120; i++) {
      a.step(1 / 60)
      b.step(1 / 60)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
    expect(Array.from(a.getBuffers().velocities!)).toEqual(Array.from(b.getBuffers().velocities!))
  })

  it('produces different trajectories for different seeds', () => {
    const a = createBoidsMode()
    const b = createBoidsMode()
    a.init(ctx({ particleCount: 150 }, 1))
    b.init(ctx({ particleCount: 150 }, 2))
    for (let i = 0; i < 60; i++) {
      a.step(1 / 60)
      b.step(1 / 60)
    }
    expect(Array.from(a.getBuffers().positions)).not.toEqual(Array.from(b.getBuffers().positions))
  })

  it('stays inside the container over a long run', () => {
    const containerSize = 6
    const radius = 0.05
    const bound = containerSize / 2 - radius
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: 400, containerSize, particleRadius: radius }))
    for (let i = 0; i < 2000; i++) mode.step(1 / 60)
    const { positions } = mode.getBuffers()
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      // Soft wall steering may briefly overshoot; a small margin tolerates that.
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 0.3)
    }
  })

  it('reports telemetry: count, average speed near cruise, and kinetic energy', () => {
    const maxSpeed = 2
    const count = 300
    const mode = createBoidsMode()
    mode.init(ctx({ particleCount: count, maxSpeed }))
    for (let i = 0; i < 60; i++) mode.step(1 / 60)
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(count)
    expect(t.averageSpeed).toBeGreaterThan(0)
    expect(t.averageSpeed).toBeLessThanOrEqual(maxSpeed + 1e-6)
    // KE = ½ Σ v² with unit mass; positive and consistent with the speed clamp ceiling.
    expect(t.kineticEnergy).toBeGreaterThan(0)
    expect(t.kineticEnergy).toBeLessThanOrEqual(0.5 * count * maxSpeed * maxSpeed + 1e-6)
    // Boids speeds cluster near maxSpeed (not Maxwell–Boltzmann) → no histogram samples.
    expect(t.speedSamples).toBeUndefined()
  })

  it('the flock aligns: alignment order parameter rises over time', () => {
    // A small group packed inside one perception radius with random headings starts
    // disordered; alignment + cohesion should make headings converge (order ↑).
    const mode = createBoidsMode()
    mode.init(
      ctx({
        particleCount: 60,
        containerSize: 8,
        perceptionRadius: 4, // all boids perceive each other from the start
        separationRadius: 0.3,
        alignmentWeight: 2,
        cohesionWeight: 1,
        separationWeight: 0.5,
      }),
    )
    const order0 = alignmentOrder(mode.getBuffers().velocities!, 60)
    for (let i = 0; i < 400; i++) mode.step(1 / 60)
    const orderN = alignmentOrder(mode.getBuffers().velocities!, 60)
    expect(orderN).toBeGreaterThan(order0)
    // And it should reach a clearly coherent flock, not just nudge upward.
    expect(orderN).toBeGreaterThan(0.7)
  })

  it('grid-accumulated steering equals brute-force O(N²) steering on small N', () => {
    // Build a deterministic small set of boids and compare the per-boid steering vector
    // produced via the mode's spatial-grid path against a brute-force accumulation using
    // the same kernel. This proves the broadphase finds the same neighbours.
    const count = 40
    const perceptionRadius = 0.6
    const separationRadius = 0.25
    const maxSpeed = 2
    const maxForce = 0.5
    const weights: SteeringWeights = { separation: 1.5, alignment: 1, cohesion: 1 }

    const mode = createBoidsMode()
    mode.init(
      ctx({
        particleCount: count,
        containerSize: 4,
        perceptionRadius,
        separationRadius,
        maxSpeed,
        maxForce,
        separationWeight: weights.separation,
        alignmentWeight: weights.alignment,
        cohesionWeight: weights.cohesion,
      }),
    )
    // Read the post-init state via the render buffers (positions+velocities).
    const positions = Float64Array.from(mode.getBuffers().positions)
    const velocities = Float64Array.from(mode.getBuffers().velocities!)

    // Brute-force reference steering for each boid using the same kernel.
    const acc = createSteeringAccumulator()
    const out: [number, number, number] = [0, 0, 0]
    const reference: number[] = []
    for (let i = 0; i < count; i++) {
      resetSteeringAccumulator(acc)
      const io = i * 3
      for (let j = 0; j < count; j++) {
        if (j === i) continue
        const jo = j * 3
        accumulateNeighbor(
          acc,
          velocities[jo],
          velocities[jo + 1],
          velocities[jo + 2],
          positions[jo] - positions[io],
          positions[jo + 1] - positions[io + 1],
          positions[jo + 2] - positions[io + 2],
          separationRadius,
          perceptionRadius,
        )
      }
      resolveSteering(acc, velocities[io], velocities[io + 1], velocities[io + 2], maxSpeed, maxForce, weights, out)
      reference.push(out[0], out[1], out[2])
    }

    const gridSteering = mode.debugComputeSteering()
    // Tolerance is Float32-scale: the brute-force reference reads the state back through
    // the Float32 render buffers while the grid path uses the internal Float64 state, so
    // identical neighbour sets still differ by ~1e-7 quantization. Exact-match on the
    // *set* of neighbours is what this proves; the residual is purely float precision.
    for (let k = 0; k < reference.length; k++) {
      expect(gridSteering[k]).toBeCloseTo(reference[k], 6)
    }
  })
})
