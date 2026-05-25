import { describe, it, expect } from 'vitest'
import { totalMomentum, kineticEnergy, temperature } from './conservedQuantities'

describe('totalMomentum', () => {
  it('sums per-axis momentum Σ m·v', () => {
    const v = new Float64Array([1, 2, 3, 4, 5, 6]) // two particles
    expect(totalMomentum(v, 2)).toEqual([5, 7, 9])
  })

  it('is zero for equal-and-opposite velocities', () => {
    const v = new Float64Array([1, -2, 0.5, -1, 2, -0.5])
    const [px, py, pz] = totalMomentum(v, 2)
    expect(px).toBeCloseTo(0, 12)
    expect(py).toBeCloseTo(0, 12)
    expect(pz).toBeCloseTo(0, 12)
  })

  it('scales with mass', () => {
    const v = new Float64Array([1, 2, 3])
    expect(totalMomentum(v, 1, 2)).toEqual([2, 4, 6])
  })

  it('returns zero for an empty system', () => {
    expect(totalMomentum(new Float64Array(0), 0)).toEqual([0, 0, 0])
  })
})

describe('kineticEnergy', () => {
  it('computes Σ ½ m v²', () => {
    const v = new Float64Array([2, 0, 0]) // speed² = 4
    expect(kineticEnergy(v, 1)).toBeCloseTo(2, 12) // ½·1·4
  })

  it('scales with mass', () => {
    const v = new Float64Array([2, 0, 0])
    expect(kineticEnergy(v, 1, 3)).toBeCloseTo(6, 12)
  })

  it('sums over all particles', () => {
    const v = new Float64Array([1, 0, 0, 0, 1, 0]) // each speed² = 1
    expect(kineticEnergy(v, 2)).toBeCloseTo(1, 12) // 2 × ½
  })
})

describe('temperature', () => {
  it('follows equipartition T = m·⟨v²⟩ / 3 (k_B = 1)', () => {
    // Each particle has v² = 3, so ⟨v²⟩ = 3 ⇒ T = 1.
    const v = new Float64Array([1, 1, 1, 1, 1, 1])
    expect(temperature(v, 2)).toBeCloseTo(1, 12)
  })

  it('scales with mass', () => {
    const v = new Float64Array([1, 1, 1])
    expect(temperature(v, 1, 2)).toBeCloseTo(2, 12)
  })

  it('relates to kinetic energy as T = 2·KE / (3·N) for unit mass', () => {
    const v = new Float64Array([0.5, 1.5, 2, 1, 0, 3])
    const n = 2
    const expected = (2 * kineticEnergy(v, n)) / (3 * n)
    expect(temperature(v, n)).toBeCloseTo(expected, 12)
  })

  it('returns zero for an empty system (no divide-by-zero)', () => {
    expect(temperature(new Float64Array(0), 0)).toBe(0)
  })
})
