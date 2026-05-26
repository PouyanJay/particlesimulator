import { describe, it, expect } from 'vitest'
import { computeCoulombAccelerations } from './coulomb'

describe('computeCoulombAccelerations', () => {
  it('repels like charges: two +1 charges accelerate apart with inverse-square magnitude', () => {
    // Charges at x=0 and x=2; k=1, q=+1 each, no softening ⇒ |a| = k·q²/r² = 1/4.
    const pos = new Float64Array([0, 0, 0, 2, 0, 0])
    const charge = new Float64Array([1, 1])
    const acc = new Float64Array(6)
    computeCoulombAccelerations(pos, charge, 2, 1, 0, acc)
    expect(acc[0]).toBeCloseTo(-0.25, 6) // particle 0 pushed toward -x (away from particle 1)
    expect(acc[3]).toBeCloseTo(0.25, 6) // particle 1 pushed toward +x (away from particle 0)
    expect(acc[1]).toBe(0)
    expect(acc[2]).toBe(0)
  })

  it('attracts opposite charges: +1 and −1 accelerate toward each other', () => {
    const pos = new Float64Array([0, 0, 0, 2, 0, 0])
    const charge = new Float64Array([1, -1])
    const acc = new Float64Array(6)
    computeCoulombAccelerations(pos, charge, 2, 1, 0, acc)
    expect(acc[0]).toBeCloseTo(0.25, 6) // particle 0 pulled toward +x (toward particle 1)
    expect(acc[3]).toBeCloseTo(-0.25, 6) // particle 1 pulled toward -x (toward particle 0)
  })

  it('obeys Newton\'s 3rd law: equal-and-opposite forces between a pair (Σ a = 0 for equal mass)', () => {
    const pos = new Float64Array([0, 0, 0, 1, 0.5, 0, -0.3, 1, 0.7, 2, -1, 0.2])
    const charge = new Float64Array([1, -1, 1, -1])
    const n = 4
    const acc = new Float64Array(n * 3)
    computeCoulombAccelerations(pos, charge, n, 1, 0.01, acc)
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < n; i++) {
      sx += acc[i * 3]
      sy += acc[i * 3 + 1]
      sz += acc[i * 3 + 2]
    }
    expect(sx).toBeCloseTo(0, 10)
    expect(sy).toBeCloseTo(0, 10)
    expect(sz).toBeCloseTo(0, 10)
  })

  it('falls off as 1/r² (4x weaker at twice the distance)', () => {
    const charge = new Float64Array([1, 1])
    const near = new Float64Array(6)
    const far = new Float64Array(6)
    computeCoulombAccelerations(new Float64Array([0, 0, 0, 2, 0, 0]), charge, 2, 1, 0, near)
    computeCoulombAccelerations(new Float64Array([0, 0, 0, 4, 0, 0]), charge, 2, 1, 0, far)
    expect(Math.abs(near[0]) / Math.abs(far[0])).toBeCloseTo(4, 6)
  })

  it('scales with the product of charges (a 2× charge doubles the force)', () => {
    const pos = new Float64Array([0, 0, 0, 2, 0, 0])
    const unit = new Float64Array(6)
    const doubled = new Float64Array(6)
    computeCoulombAccelerations(pos, new Float64Array([1, 1]), 2, 1, 0, unit)
    computeCoulombAccelerations(pos, new Float64Array([2, 1]), 2, 1, 0, doubled)
    expect(Math.abs(doubled[0]) / Math.abs(unit[0])).toBeCloseTo(2, 6)
  })

  it('softening keeps coincident particles finite (no singularity)', () => {
    const pos = new Float64Array([0, 0, 0, 0, 0, 0])
    const charge = new Float64Array([1, -1])
    const acc = new Float64Array(6)
    computeCoulombAccelerations(pos, charge, 2, 1, 0.04, acc)
    for (const a of acc) expect(Number.isFinite(a)).toBe(true)
  })

  it('zeroes the output accumulator before summing', () => {
    const acc = new Float64Array([9, 9, 9, 9, 9, 9])
    computeCoulombAccelerations(new Float64Array([0, 0, 0, 2, 0, 0]), new Float64Array([1, 1]), 2, 1, 0, acc)
    expect(acc[1]).toBe(0) // would still be 9 if not reset
  })
})
