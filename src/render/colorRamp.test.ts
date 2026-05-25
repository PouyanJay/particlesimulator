import { describe, it, expect } from 'vitest'
import { speedToRgb, SLOW_COLOR, FAST_COLOR } from './colorRamp'

// Pure, framework-free so it's unit-testable in the node environment (no three.js).
// A direct two-stop blue→red blend (no hue sweep through green/yellow).
describe('speedToRgb', () => {
  it('maps zero speed to the slow (blue) endpoint', () => {
    expect(speedToRgb(0, 2)).toEqual(SLOW_COLOR)
  })

  it('maps max speed to the fast (red) endpoint', () => {
    expect(speedToRgb(2, 2)).toEqual(FAST_COLOR)
  })

  it('blends linearly to the midpoint at half speed', () => {
    const [r, g, b] = speedToRgb(1, 2)
    expect(r).toBeCloseTo((SLOW_COLOR[0] + FAST_COLOR[0]) / 2, 6)
    expect(g).toBeCloseTo((SLOW_COLOR[1] + FAST_COLOR[1]) / 2, 6)
    expect(b).toBeCloseTo((SLOW_COLOR[2] + FAST_COLOR[2]) / 2, 6)
  })

  it('clamps speeds beyond vMax to the fast endpoint (no overshoot)', () => {
    expect(speedToRgb(10, 2)).toEqual(FAST_COLOR)
  })

  it('treats a non-positive vMax as the slow end (avoids divide-by-zero)', () => {
    expect(speedToRgb(1, 0)).toEqual(SLOW_COLOR)
  })

  it('writes into and returns the provided out array (no allocation)', () => {
    const out: [number, number, number] = [0, 0, 0]
    const result = speedToRgb(1, 2, out)
    expect(result).toBe(out) // same reference, not a fresh array
    expect(out[0]).toBeCloseTo((SLOW_COLOR[0] + FAST_COLOR[0]) / 2, 6)
  })

  it('keeps every channel within [0, 1]', () => {
    for (let s = 0; s <= 2; s += 0.1) {
      for (const c of speedToRgb(s, 2)) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(1)
      }
    }
  })
})
