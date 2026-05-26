import { describe, it, expect } from 'vitest'
import { reflectInBox, applyGravity, thermostatRescale } from './environment'

describe('reflectInBox', () => {
  it('reflects a particle moving outward and clamps it inside', () => {
    const pos = new Float64Array([1.5, 0, 0])
    const vel = new Float64Array([2, 0, 0])
    reflectInBox(pos, vel, 1, 1) // halfBound 1
    expect(pos[0]).toBe(1)
    expect(vel[0]).toBe(-2) // flipped (elastic)
  })

  it('leaves a particle that is past the wall but already moving inward', () => {
    const pos = new Float64Array([1.5, 0, 0])
    const vel = new Float64Array([-2, 0, 0]) // already heading back in
    reflectInBox(pos, vel, 1, 1)
    expect(vel[0]).toBe(-2) // untouched
    expect(pos[0]).toBe(1.5)
  })

  it('scales the rebound by restitution', () => {
    const pos = new Float64Array([1.2, 0, 0])
    const vel = new Float64Array([2, 0, 0])
    reflectInBox(pos, vel, 1, 1, 0.5)
    expect(vel[0]).toBeCloseTo(-1, 12) // -2 * 0.5
  })

  it('returns the wall impulse m·|v|·(1+e) (elastic ⇒ 2·m·|v|)', () => {
    const pos = new Float64Array([1.2, 0, 0])
    const vel = new Float64Array([3, 0, 0])
    const impulse = reflectInBox(pos, vel, 1, 1, 1, 2) // mass 2, elastic
    expect(impulse).toBeCloseTo(2 * 2 * 3, 12) // 2·m·|v| = 12
  })

  it('reports zero impulse when nothing hits a wall', () => {
    const pos = new Float64Array([0, 0, 0])
    const vel = new Float64Array([1, 1, 1])
    expect(reflectInBox(pos, vel, 1, 5)).toBe(0)
  })
})

describe('applyGravity', () => {
  it('subtracts g·dt from the y velocity of every particle', () => {
    const vel = new Float64Array([1, 1, 1, 2, 2, 2])
    applyGravity(vel, 2, 10, 0.1) // dv = 1
    expect(vel[1]).toBeCloseTo(0, 12)
    expect(vel[4]).toBeCloseTo(1, 12)
    expect(vel[0]).toBe(1) // x untouched
    expect(vel[2]).toBe(1) // z untouched
  })

  it('is a no-op when gravity is off', () => {
    const vel = new Float64Array([1, 1, 1])
    applyGravity(vel, 1, 0, 0.1)
    expect(Array.from(vel)).toEqual([1, 1, 1])
  })
})

describe('thermostatRescale', () => {
  const temperatureOf = (v: Float64Array, n: number, m = 1) => {
    let sumSq = 0
    for (let i = 0; i < n; i++) sumSq += v[i * 3] ** 2 + v[i * 3 + 1] ** 2 + v[i * 3 + 2] ** 2
    return (m * (sumSq / n)) / 3
  }

  it('rescales velocities so the kinetic temperature equals the target', () => {
    const v = new Float64Array([1, 2, 3, -2, 1, 0]) // arbitrary
    thermostatRescale(v, 2, 1.5)
    expect(temperatureOf(v, 2)).toBeCloseTo(1.5, 10)
  })

  it('preserves direction (pure scaling, no reordering)', () => {
    const v = new Float64Array([3, 0, 0])
    thermostatRescale(v, 1, 3) // T from [3,0,0] is 3 ⇒ scale 1
    expect(Array.from(v)).toEqual([3, 0, 0])
  })

  it('is a no-op for an empty system, a non-positive target, or a system at rest', () => {
    const atRest = new Float64Array([0, 0, 0])
    thermostatRescale(atRest, 1, 2)
    expect(Array.from(atRest)).toEqual([0, 0, 0])
    const v = new Float64Array([1, 1, 1])
    thermostatRescale(v, 1, 0)
    expect(Array.from(v)).toEqual([1, 1, 1])
  })
})
