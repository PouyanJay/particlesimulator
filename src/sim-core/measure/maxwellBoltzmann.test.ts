import { describe, it, expect } from 'vitest'
import { maxwellBoltzmannPdf, mostProbableSpeed } from './maxwellBoltzmann'

// 3D Maxwell–Boltzmann speed distribution, parameterised by the mean-square speed
// <v²> = 3kT/m. Peak (most probable speed) is at v_p = sqrt(2/3 · <v²>).
describe('maxwellBoltzmannPdf', () => {
  it('is zero at zero speed', () => {
    expect(maxwellBoltzmannPdf(0, 4)).toBe(0)
  })

  it('is positive for positive speeds and decays to ~0 far out', () => {
    expect(maxwellBoltzmannPdf(1, 4)).toBeGreaterThan(0)
    expect(maxwellBoltzmannPdf(20, 4)).toBeLessThan(1e-6)
  })

  it('peaks at the most-probable speed v_p = sqrt(2/3·<v²>)', () => {
    const meanSquare = 6 // ⇒ v_p = sqrt(4) = 2
    const vp = mostProbableSpeed(meanSquare)
    expect(vp).toBeCloseTo(2, 6)
    const peak = maxwellBoltzmannPdf(vp, meanSquare)
    expect(maxwellBoltzmannPdf(vp - 0.3, meanSquare)).toBeLessThan(peak)
    expect(maxwellBoltzmannPdf(vp + 0.3, meanSquare)).toBeLessThan(peak)
  })

  it('integrates to approximately 1 (normalised PDF)', () => {
    const meanSquare = 4
    let area = 0
    const dv = 0.001
    for (let v = 0; v < 30; v += dv) area += maxwellBoltzmannPdf(v, meanSquare) * dv
    expect(area).toBeCloseTo(1, 2)
  })

  it('its <v²> matches the parameter (consistency of the distribution)', () => {
    const meanSquare = 5
    let m2 = 0
    const dv = 0.001
    for (let v = 0; v < 40; v += dv) m2 += v * v * maxwellBoltzmannPdf(v, meanSquare) * dv
    expect(m2).toBeCloseTo(meanSquare, 1)
  })

  it('returns 0 for a non-positive mean-square speed (avoids divide-by-zero)', () => {
    expect(maxwellBoltzmannPdf(1, 0)).toBe(0)
  })
})
