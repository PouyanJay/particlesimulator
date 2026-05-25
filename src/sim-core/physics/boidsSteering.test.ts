import { describe, it, expect } from 'vitest'
import {
  createSteeringAccumulator,
  accumulateNeighbor,
  resolveSteering,
  limitMagnitude,
  type SteeringWeights,
} from './boidsSteering'

// The steering kernel implements classic Reynolds rules over an explicit list of
// neighbours, decoupled from any neighbour search so the rules are unit-testable in
// isolation (mirroring particleLifeForce as a separate tested kernel). Each test
// exercises one rule by zeroing the other weights.

const SEPARATION_ONLY: SteeringWeights = { separation: 1, alignment: 0, cohesion: 0 }
const ALIGNMENT_ONLY: SteeringWeights = { separation: 0, alignment: 1, cohesion: 0 }
const COHESION_ONLY: SteeringWeights = { separation: 0, alignment: 0, cohesion: 1 }

const PERCEPTION = 1
const SEPARATION_RADIUS = 0.4
const MAX_SPEED = 2
const MAX_FORCE = 10 // large so clamping doesn't mask the steering direction under test

describe('boidsSteering — separation', () => {
  it('pushes a boid away from a close neighbour', () => {
    // Self at origin moving +x; neighbour just to its +x, inside the separation radius.
    const acc = createSteeringAccumulator()
    accumulateNeighbor(acc, 0, 0, 0, 0.2, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, MAX_FORCE, SEPARATION_ONLY, out)
    // Steering should have a negative-x component (away from the +x neighbour).
    expect(out[0]).toBeLessThan(0)
  })

  it('weights closer neighbours more strongly than farther ones', () => {
    const near = createSteeringAccumulator()
    accumulateNeighbor(near, 0, 0, 0, 0.1, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const far = createSteeringAccumulator()
    accumulateNeighbor(far, 0, 0, 0, 0.35, 0, 0, SEPARATION_RADIUS, PERCEPTION)

    const outNear: [number, number, number] = [0, 0, 0]
    const outFar: [number, number, number] = [0, 0, 0]
    resolveSteering(near, 1, 0, 0, MAX_SPEED, MAX_FORCE, SEPARATION_ONLY, outNear)
    resolveSteering(far, 1, 0, 0, MAX_SPEED, MAX_FORCE, SEPARATION_ONLY, outFar)
    // The very-close neighbour pushes harder (larger-magnitude away-steer).
    expect(Math.abs(outNear[0])).toBeGreaterThan(Math.abs(outFar[0]))
  })

  it('ignores neighbours beyond the separation radius for the separation term', () => {
    const acc = createSteeringAccumulator()
    // Inside perception but outside separation radius → no separation contribution.
    accumulateNeighbor(acc, 0, 0, 0, 0.8, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, MAX_FORCE, SEPARATION_ONLY, out)
    expect(out[0]).toBeCloseTo(0, 9)
    expect(out[1]).toBeCloseTo(0, 9)
    expect(out[2]).toBeCloseTo(0, 9)
  })
})

describe('boidsSteering — cohesion', () => {
  it('pulls a boid toward a distant (but in-perception) neighbour', () => {
    const acc = createSteeringAccumulator()
    // Neighbour at +x, beyond separation radius but within perception.
    accumulateNeighbor(acc, 0, 0, 0, 0.7, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, MAX_FORCE, COHESION_ONLY, out)
    // Cohesion steers toward the neighbour's position (+x).
    expect(out[0]).toBeGreaterThan(0)
  })

  it('produces no cohesion steer when the boid is already at the centre of mass', () => {
    const acc = createSteeringAccumulator()
    // Two symmetric neighbours: centre of mass coincides with the self position.
    accumulateNeighbor(acc, 0, 0, 0, 0.6, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    accumulateNeighbor(acc, 0, 0, 0, -0.6, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, MAX_FORCE, COHESION_ONLY, out)
    expect(out[0]).toBeCloseTo(0, 9)
    expect(out[1]).toBeCloseTo(0, 9)
    expect(out[2]).toBeCloseTo(0, 9)
  })
})

describe('boidsSteering — alignment', () => {
  it('rotates a boid velocity toward a neighbour heading', () => {
    // Self moving +x; a single neighbour moving +y. Alignment should steer toward +y.
    const acc = createSteeringAccumulator()
    accumulateNeighbor(acc, 0, MAX_SPEED, 0, 0.5, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, MAX_SPEED, 0, 0, MAX_SPEED, MAX_FORCE, ALIGNMENT_ONLY, out)
    // Steering acquires a +y component (turning the heading toward the neighbour's).
    expect(out[1]).toBeGreaterThan(0)
  })

  it('produces no alignment steer when the boid already matches the neighbour heading', () => {
    const acc = createSteeringAccumulator()
    accumulateNeighbor(acc, MAX_SPEED, 0, 0, 0.5, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, MAX_SPEED, 0, 0, MAX_SPEED, MAX_FORCE, ALIGNMENT_ONLY, out)
    expect(out[0]).toBeCloseTo(0, 9)
    expect(out[1]).toBeCloseTo(0, 9)
    expect(out[2]).toBeCloseTo(0, 9)
  })
})

describe('boidsSteering — combined & clamping', () => {
  it('returns zero steering with no neighbours', () => {
    const acc = createSteeringAccumulator()
    const out: [number, number, number] = [0, 0, 0]
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, MAX_FORCE, { separation: 1, alignment: 1, cohesion: 1 }, out)
    expect(out[0]).toBe(0)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(0)
  })

  it('clamps the combined steering force to maxForce', () => {
    const acc = createSteeringAccumulator()
    // A very close neighbour generates a large separation steer; cap it at maxForce.
    accumulateNeighbor(acc, 0, 0, 0, 0.001, 0, 0, SEPARATION_RADIUS, PERCEPTION)
    const out: [number, number, number] = [0, 0, 0]
    const maxForce = 3
    resolveSteering(acc, 1, 0, 0, MAX_SPEED, maxForce, SEPARATION_ONLY, out)
    const mag = Math.hypot(out[0], out[1], out[2])
    expect(mag).toBeLessThanOrEqual(maxForce + 1e-9)
    expect(mag).toBeCloseTo(maxForce, 6)
  })
})

describe('limitMagnitude', () => {
  it('leaves a vector below the limit unchanged', () => {
    const v: [number, number, number] = [1, 0, 0]
    limitMagnitude(v, 2)
    expect(v).toEqual([1, 0, 0])
  })

  it('scales a vector above the limit down to the limit', () => {
    const v: [number, number, number] = [3, 4, 0] // magnitude 5
    limitMagnitude(v, 1)
    expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 9)
    expect(v[0]).toBeCloseTo(0.6, 9)
    expect(v[1]).toBeCloseTo(0.8, 9)
  })

  it('treats the zero vector safely', () => {
    const v: [number, number, number] = [0, 0, 0]
    limitMagnitude(v, 1)
    expect(v).toEqual([0, 0, 0])
  })
})
