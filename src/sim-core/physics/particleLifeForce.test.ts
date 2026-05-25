import { describe, it, expect } from 'vitest'
import { particleLifeForce } from './particleLifeForce'

// Signed force magnitude vs normalized distance r ∈ [0,1]:
//  - r < beta:        universal short-range repulsion, -1 at r=0 rising to 0 at r=beta
//  - beta <= r < 1:   triangular, peaks at the type-pair coefficient `a` at r=(1+beta)/2
//  - r >= 1:          no interaction
describe('particleLifeForce', () => {
  const beta = 0.3

  it('is maximally repulsive at zero distance', () => {
    expect(particleLifeForce(0, 1, beta)).toBeCloseTo(-1, 6)
  })

  it('is zero at the repulsion boundary (r = beta)', () => {
    expect(particleLifeForce(beta, 1, beta)).toBeCloseTo(0, 6)
  })

  it('repels within the repulsion zone regardless of the coefficient', () => {
    // Even with a strongly attractive coefficient, short range still repels.
    expect(particleLifeForce(0.15, 1, beta)).toBeLessThan(0)
    expect(particleLifeForce(0.15, -1, beta)).toBeLessThan(0)
  })

  it('peaks at the coefficient value at the midpoint of the attraction zone', () => {
    const mid = (1 + beta) / 2
    expect(particleLifeForce(mid, 0.8, beta)).toBeCloseTo(0.8, 6)
    expect(particleLifeForce(mid, -0.5, beta)).toBeCloseTo(-0.5, 6)
  })

  it('vanishes at and beyond the interaction radius', () => {
    expect(particleLifeForce(1, 1, beta)).toBeCloseTo(0, 6)
    expect(particleLifeForce(1.5, 1, beta)).toBe(0)
  })

  it('attraction-zone force has the sign of the coefficient', () => {
    expect(particleLifeForce(0.6, 1, beta)).toBeGreaterThan(0)
    expect(particleLifeForce(0.6, -1, beta)).toBeLessThan(0)
  })
})
