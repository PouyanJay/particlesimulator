import { describe, it, expect } from 'vitest'
import { defaultParamValues } from './paramSchema'
import { elasticGasSchema } from './modes/elasticGas'
import type { ParamSchema } from './types'

describe('defaultParamValues', () => {
  it('extracts the default value of every parameter', () => {
    const schema = {
      speed: { type: 'number', label: 'Speed', default: 1.5, min: 0, max: 5 },
      enabled: { type: 'boolean', label: 'Enabled', default: true },
    } as const satisfies ParamSchema
    expect(defaultParamValues(schema)).toEqual({ speed: 1.5, enabled: true })
  })

  it('derives defaults for the elastic gas schema', () => {
    expect(defaultParamValues(elasticGasSchema)).toEqual({
      particleCount: 200,
      particleRadius: 0.08,
      initialVelocity: 1.0,
      restitution: 1.0,
      containerSize: 2.5,
      gravity: 0, // external gravity strength (0 = off); was a boolean toggle before the kit
    })
  })

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = defaultParamValues(elasticGasSchema)
    const b = defaultParamValues(elasticGasSchema)
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})
