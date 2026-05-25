import { describe, it, expect } from 'vitest'
import { computeSpeedHistogram } from './speedHistogram'

describe('computeSpeedHistogram', () => {
  it('produces binCount bins with centers at (i + 0.5)·binWidth', () => {
    const h = computeSpeedHistogram([0.5, 1.5, 2.5], 3, 4, 4) // binWidth 1
    expect(h.binWidth).toBe(1)
    expect(h.binCenters).toEqual([0.5, 1.5, 2.5, 3.5])
    expect(h.density.length).toBe(4)
  })

  it('places each speed in the correct bin', () => {
    // speeds all = 1.0, maxSpeed 4, 4 bins (binWidth 1) ⇒ all land in bin index 1.
    const speeds = [1, 1, 1, 1]
    const h = computeSpeedHistogram(speeds, 4, 4, 4)
    expect(h.density[0]).toBe(0)
    expect(h.density[1]).toBeGreaterThan(0)
    expect(h.density[2]).toBe(0)
  })

  it('returns a normalised density (area ≈ 1 when all speeds are in range)', () => {
    const speeds = Array.from({ length: 1000 }, (_, i) => (i / 1000) * 4) // 0..4 uniform
    const h = computeSpeedHistogram(speeds, 1000, 20, 4)
    const area = h.density.reduce((s, d) => s + d * h.binWidth, 0)
    expect(area).toBeCloseTo(1, 6)
  })

  it('clamps speeds at or beyond maxSpeed into the last bin', () => {
    const h = computeSpeedHistogram([10, 10], 2, 4, 4)
    expect(h.density[3]).toBeGreaterThan(0)
  })

  it('respects sampleCount (ignores trailing array slots)', () => {
    const speeds = new Float32Array([1, 1, 0, 0, 0]) // only first 2 valid
    const h = computeSpeedHistogram(speeds, 2, 4, 4)
    const area = h.density.reduce((s, d) => s + d * h.binWidth, 0)
    expect(area).toBeCloseTo(1, 6)
  })

  it('returns all-zero density for no samples (no divide-by-zero)', () => {
    const h = computeSpeedHistogram([], 0, 4, 4)
    expect(h.density.every((d) => d === 0)).toBe(true)
  })
})
