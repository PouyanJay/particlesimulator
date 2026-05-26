import { describe, it, expect } from 'vitest'
import { poly6, spikyGradientCoefficient, viscosityLaplacian } from './sphKernels'

describe('SPH smoothing kernels (Müller 2003, 3-D)', () => {
  const h = 1.5

  describe('poly6 (density kernel)', () => {
    it('is zero at and beyond the support radius h', () => {
      expect(poly6(h, h)).toBe(0)
      expect(poly6(h + 0.1, h)).toBe(0)
      expect(poly6(100, h)).toBe(0)
    })

    it('is maximal at r = 0 and decreases monotonically to the support', () => {
      const w0 = poly6(0, h)
      expect(w0).toBeGreaterThan(0)
      expect(poly6(0.5, h)).toBeLessThan(w0)
      expect(poly6(1.0, h)).toBeLessThan(poly6(0.5, h))
      expect(poly6(1.4, h)).toBeLessThan(poly6(1.0, h))
    })

    it('integrates to 1 over its spherical support (normalisation)', () => {
      // Numerically integrate ∫ W(r) 4πr² dr from 0 to h via fine Riemann sum.
      const steps = 20000
      const dr = h / steps
      let integral = 0
      for (let s = 0; s < steps; s++) {
        const r = (s + 0.5) * dr
        integral += poly6(r, h) * 4 * Math.PI * r * r * dr
      }
      expect(integral).toBeCloseTo(1, 2)
    })

    it('scales correctly with h (a wider kernel is shorter at the centre)', () => {
      expect(poly6(0, 3)).toBeLessThan(poly6(0, 1.5)) // ∝ 1/h³ at the centre
    })
  })

  describe('spikyGradientCoefficient (pressure-force kernel)', () => {
    it('is zero at and beyond the support radius', () => {
      expect(spikyGradientCoefficient(h, h)).toBe(0)
      expect(spikyGradientCoefficient(h + 1, h)).toBe(0)
    })

    it('is negative inside the support (dW/dr < 0 — the kernel falls off with distance)', () => {
      expect(spikyGradientCoefficient(0.5, h)).toBeLessThan(0)
      expect(spikyGradientCoefficient(1.0, h)).toBeLessThan(0)
    })

    it('has the steepest (most negative) slope near the centre — the short-range repulsion core', () => {
      expect(spikyGradientCoefficient(0.2, h)).toBeLessThan(spikyGradientCoefficient(1.0, h))
    })

    it('matches the exact analytic value −45/(π·h⁶)·(h−r)² (guards the normalisation constant)', () => {
      const expected = -(45 / (Math.PI * 1.5 ** 6)) * (1.5 - 0.5) ** 2 // ≈ −1.25753
      expect(spikyGradientCoefficient(0.5, 1.5)).toBeCloseTo(expected, 10)
      expect(expected).toBeCloseTo(-1.25753, 4) // golden literal: catches an edited constant
    })
  })

  describe('viscosityLaplacian', () => {
    it('is zero at and beyond the support radius', () => {
      expect(viscosityLaplacian(h, h)).toBeCloseTo(0, 12)
      expect(viscosityLaplacian(h + 1, h)).toBe(0)
    })

    it('is positive inside the support and decreases linearly to zero', () => {
      expect(viscosityLaplacian(0.1, h)).toBeGreaterThan(0)
      expect(viscosityLaplacian(0.5, h)).toBeGreaterThan(viscosityLaplacian(1.0, h))
    })

    it('matches the exact analytic value 45/(π·h⁶)·(h−r) (guards the normalisation constant)', () => {
      const expected = (45 / (Math.PI * 1.5 ** 6)) * (1.5 - 0.5) // ≈ 1.25753
      expect(viscosityLaplacian(0.5, 1.5)).toBeCloseTo(expected, 10)
      expect(expected).toBeCloseTo(1.25753, 4) // golden literal: catches an edited constant
    })
  })
})
