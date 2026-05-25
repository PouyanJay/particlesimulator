import { describe, it, expect } from 'vitest'
import { speedToHsl } from './colorRamp'

// Pure, framework-free so it's unit-testable in the node environment (no three.js).
describe('speedToHsl', () => {
  it('maps zero speed to blue (hue ~0.66)', () => {
    const [h] = speedToHsl(0, 2)
    expect(h).toBeCloseTo(0.66, 5)
  })

  it('maps max speed to red (hue 0)', () => {
    const [h] = speedToHsl(2, 2)
    expect(h).toBeCloseTo(0, 5)
  })

  it('maps the midpoint to a mid hue', () => {
    const [h] = speedToHsl(1, 2)
    expect(h).toBeCloseTo(0.33, 5)
  })

  it('clamps speeds beyond vMax to red (does not overshoot)', () => {
    const [h] = speedToHsl(10, 2)
    expect(h).toBe(0)
  })

  it('treats a non-positive vMax as the slow end (avoids divide-by-zero)', () => {
    expect(speedToHsl(1, 0)[0]).toBeCloseTo(0.66, 5)
  })

  it('returns constant saturation and lightness', () => {
    const [, s, l] = speedToHsl(0.7, 2)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(1)
    expect(l).toBeGreaterThan(0)
    expect(l).toBeLessThan(1)
  })
})
