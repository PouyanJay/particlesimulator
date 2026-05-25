import { describe, it, expect } from 'vitest'
import { createRng, randomInRange } from './rng'

describe('createRng', () => {
  it('is deterministic: the same seed produces the same sequence', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('returns values in the half-open interval [0, 1)', () => {
    const rng = createRng(99)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is approximately uniform (mean near 0.5 over many samples)', () => {
    const rng = createRng(7)
    let sum = 0
    const n = 100000
    for (let i = 0; i < n; i++) sum += rng()
    expect(sum / n).toBeCloseTo(0.5, 2)
  })
})

describe('randomInRange', () => {
  it('returns values within [min, max)', () => {
    const rng = createRng(3)
    for (let i = 0; i < 10000; i++) {
      const v = randomInRange(rng, -2, 5)
      expect(v).toBeGreaterThanOrEqual(-2)
      expect(v).toBeLessThan(5)
    }
  })

  it('has a mean near the midpoint of the range', () => {
    const rng = createRng(8)
    let sum = 0
    const n = 100000
    for (let i = 0; i < n; i++) sum += randomInRange(rng, 10, 20)
    expect(sum / n).toBeCloseTo(15, 1)
  })
})
