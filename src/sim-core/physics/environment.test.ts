import { describe, it, expect } from 'vitest'
import { reflectInBox, applyGravity } from './environment'

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
