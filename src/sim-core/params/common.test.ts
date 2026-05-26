import { describe, it, expect } from 'vitest'
import { countParam, containerParam, displaySizeParam, gravityParam } from './common'

describe('common params kit', () => {
  it('count/container/displaySize are number params in the scene group', () => {
    for (const p of [
      countParam({ label: 'Atom Count', default: 216, min: 8, max: 4000 }),
      containerParam({ label: 'Box Size', default: 14, min: 6, max: 30 }),
      displaySizeParam({ label: 'Body Size', default: 0.04, min: 0.02, max: 0.12 }),
    ]) {
      expect(p.type).toBe('number')
      expect(p.group).toBe('scene')
    }
  })

  it('passes the supplied label and range through', () => {
    const p = countParam({ label: 'Atom Count', default: 216, min: 8, max: 4000, step: 1 })
    expect(p).toMatchObject({ label: 'Atom Count', default: 216, min: 8, max: 4000, step: 1 })
  })

  it('gravity defaults to off (0), labelled and grouped with the scene', () => {
    const g = gravityParam()
    expect(g).toMatchObject({ type: 'number', group: 'scene', label: 'Gravity', default: 0, min: 0 })
    expect(g.max).toBeGreaterThan(0)
  })

  it('gravity range is overridable per mode', () => {
    expect(gravityParam({ max: 3 }).max).toBe(3)
  })
})
