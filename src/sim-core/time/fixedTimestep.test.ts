import { describe, it, expect } from 'vitest'
import { createFixedTimestep } from './fixedTimestep'

describe('createFixedTimestep', () => {
  // A generous catch-up cap so these step-counting tests aren't limited by the clamp;
  // the clamp itself is covered by the dedicated test below.
  const NO_CLAMP = 1000

  it('runs exactly N fixed steps when the elapsed time is N * dt', () => {
    const clock = createFixedTimestep(0.5, NO_CLAMP)
    let steps = 0
    expect(clock.advance(2.0, () => steps++)).toBe(4)
    expect(steps).toBe(4)
  })

  it('passes the fixed dt to every step (never the variable frame time)', () => {
    const clock = createFixedTimestep(0.5, NO_CLAMP)
    const dts: number[] = []
    clock.advance(1.5, (dt) => dts.push(dt))
    expect(dts).toEqual([0.5, 0.5, 0.5])
  })

  it('carries the remainder across calls instead of dropping time', () => {
    const clock = createFixedTimestep(0.5, NO_CLAMP)
    expect(clock.advance(0.75, () => {})).toBe(1) // 0.25 left over
    expect(clock.advance(0.25, () => {})).toBe(1) // 0.25 + 0.25 = 0.5 -> one step
  })

  it('takes no steps for zero or negative elapsed time', () => {
    const clock = createFixedTimestep(0.5)
    expect(clock.advance(0, () => {})).toBe(0)
    expect(clock.advance(-1, () => {})).toBe(0)
  })

  it('clamps a huge frame time to avoid the spiral of death', () => {
    const clock = createFixedTimestep(0.5, 2.0) // max 2.0s of catch-up per advance
    let steps = 0
    expect(clock.advance(100, () => steps++)).toBe(4)
    expect(steps).toBe(4)
  })
})
