import { describe, it, expect } from 'vitest'
import { SUBSTANCES, REDUCED, getSubstance } from './substances'

describe('substances', () => {
  it('exposes Reduced plus the four noble-gas LJ fluids', () => {
    expect(SUBSTANCES.map((s) => s.id)).toEqual(['reduced', 'argon', 'neon', 'krypton', 'xenon'])
  })

  it('treats the reduced system as the identity with no units', () => {
    expect(REDUCED.scale).toEqual({ temperature: 1, energy: 1, pressure: 1, momentum: 1, speed: 1 })
    expect(Object.values(REDUCED.unit).every((u) => u === '')).toBe(true)
  })

  it('falls back to Reduced for an unknown id', () => {
    expect(getSubstance('nope')).toBe(REDUCED)
  })

  it("maps reduced temperature to kelvin via the substance's ε/k_B", () => {
    // Argon: ε/k_B = 119.8 K, so a reduced T* of 1.2 is ~143.8 K.
    const argon = getSubstance('argon')
    expect(argon.scale.temperature).toBeCloseTo(119.8, 6)
    expect(1.2 * argon.scale.temperature).toBeCloseTo(143.76, 2)
    expect(argon.unit.temperature).toBe('K')
  })

  it('derives the velocity scale √(ε/m) — argon ≈ 158 m/s', () => {
    // v_scale = √(ε/m); for argon this is the well-known ~1.6×10² m/s thermal scale.
    const argon = getSubstance('argon')
    expect(argon.scale.speed).toBeGreaterThan(150)
    expect(argon.scale.speed).toBeLessThan(165)
  })

  it('derives a consistent set of scales (speed² ≈ energy / mass via momentum & energy)', () => {
    // momentum = √(mε), speed = √(ε/m) ⇒ momentum · speed = ε (the energy scale).
    const argon = getSubstance('argon')
    expect(argon.scale.momentum * argon.scale.speed).toBeCloseTo(argon.scale.energy, 30)
  })

  it('orders the well depths Neon < Argon < Krypton < Xenon (physical)', () => {
    const t = (id: string) => getSubstance(id).scale.temperature
    expect(t('neon')).toBeLessThan(t('argon'))
    expect(t('argon')).toBeLessThan(t('krypton'))
    expect(t('krypton')).toBeLessThan(t('xenon'))
  })
})
