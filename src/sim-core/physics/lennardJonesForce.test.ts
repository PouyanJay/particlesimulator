import { describe, it, expect } from 'vitest'
import { lennardJonesForce, lennardJonesPotential } from './lennardJonesForce'

/**
 * The Lennard-Jones kernel is the credibility-defining piece of the MD gas, so its
 * mathematical properties are pinned down directly (not via the mode). We use the
 * *force-shifted* form: the raw force has F(r_c) ≠ 0, so we subtract that constant to
 * make the force continuous (zero) at the cutoff — this is the property the integrator
 * relies on for well-behaved energy.
 */
describe('lennardJonesForce kernel', () => {
  const eps = 1.5
  const sigma = 1.2
  const rc = 2.5 * sigma
  const rMin = Math.pow(2, 1 / 6) * sigma // potential minimum / force zero-crossing

  it('is strongly repulsive (positive) for r well below the minimum', () => {
    expect(lennardJonesForce(0.9 * sigma, eps, sigma, rc)).toBeGreaterThan(0)
    expect(lennardJonesForce(0.8 * sigma, eps, sigma, rc)).toBeGreaterThan(
      lennardJonesForce(0.9 * sigma, eps, sigma, rc),
    )
  })

  it('is attractive (negative) between the minimum and the cutoff', () => {
    const f = lennardJonesForce(1.5 * sigma, eps, sigma, rc)
    expect(f).toBeLessThan(0)
  })

  it('crosses zero at the unshifted minimum r = 2^(1/6)·σ (within the shift)', () => {
    // The raw force is zero at rMin; the force-shift moves the zero slightly, so the
    // force there equals exactly minus the shift constant F_raw(rc) — small relative to
    // the steep repulsive wall — rather than precisely zero.
    const sr6c = (sigma / rc) ** 6
    const shift = (24 * eps / rc) * (2 * sr6c * sr6c - sr6c)
    const fAtMin = lennardJonesForce(rMin, eps, sigma, rc)
    expect(fAtMin).toBeCloseTo(-shift, 10)
    // The shift is a small fraction of a typical near-contact repulsive force.
    expect(Math.abs(fAtMin)).toBeLessThan(0.1 * Math.abs(lennardJonesForce(0.9 * sigma, eps, sigma, rc)))
  })

  it('is exactly zero at and beyond the cutoff (continuity at rc)', () => {
    expect(lennardJonesForce(rc, eps, sigma, rc)).toBe(0)
    expect(lennardJonesForce(rc + 0.5, eps, sigma, rc)).toBe(0)
    expect(lennardJonesForce(rc * 2, eps, sigma, rc)).toBe(0)
  })

  it('is continuous at the cutoff: force just inside ≈ 0', () => {
    const justInside = lennardJonesForce(rc - 1e-6, eps, sigma, rc)
    expect(Math.abs(justInside)).toBeLessThan(1e-3)
  })

  it('matches the analytic force-shifted formula at a sample radius', () => {
    const r = 1.1 * sigma
    const sr6 = (sigma / r) ** 6
    const sr6c = (sigma / rc) ** 6
    const raw = (24 * eps / r) * (2 * sr6 * sr6 - sr6)
    const rawAtRc = (24 * eps / rc) * (2 * sr6c * sr6c - sr6c)
    expect(lennardJonesForce(r, eps, sigma, rc)).toBeCloseTo(raw - rawAtRc, 10)
  })

  describe('lennardJonesPotential', () => {
    it('has its minimum at r = 2^(1/6)·σ with value ≈ -ε', () => {
      const vMin = lennardJonesPotential(rMin, eps, sigma)
      expect(vMin).toBeCloseTo(-eps, 10)
      // Slightly off the minimum is higher (less negative) on both sides.
      expect(lennardJonesPotential(rMin * 0.98, eps, sigma)).toBeGreaterThan(vMin)
      expect(lennardJonesPotential(rMin * 1.02, eps, sigma)).toBeGreaterThan(vMin)
    })

    it('is zero at r = σ (the potential root)', () => {
      expect(lennardJonesPotential(sigma, eps, sigma)).toBeCloseTo(0, 10)
    })
  })
})
