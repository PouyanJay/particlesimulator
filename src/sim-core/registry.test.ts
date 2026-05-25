import { describe, it, expect } from 'vitest'
import { createRegistry } from './registry'
import { createElasticGasMode } from './modes/elasticGas'

describe('SimMode registry', () => {
  it('lists registered modes by id and label', () => {
    const reg = createRegistry()
    reg.register(createElasticGasMode)
    expect(reg.list()).toEqual([{ id: 'elastic-gas', label: 'Elastic Gas' }])
  })

  it('reports membership via has()', () => {
    const reg = createRegistry()
    reg.register(createElasticGasMode)
    expect(reg.has('elastic-gas')).toBe(true)
    expect(reg.has('nope')).toBe(false)
  })

  it('creates a fresh mode instance by id', () => {
    const reg = createRegistry()
    reg.register(createElasticGasMode)
    const a = reg.create('elastic-gas')
    const b = reg.create('elastic-gas')
    expect(a.id).toBe('elastic-gas')
    expect(a).not.toBe(b) // distinct instances, not a shared singleton
  })

  it('throws when creating an unknown mode', () => {
    const reg = createRegistry()
    expect(() => reg.create('missing')).toThrow(/missing/)
  })

  it('throws when registering a duplicate id', () => {
    const reg = createRegistry()
    reg.register(createElasticGasMode)
    expect(() => reg.register(createElasticGasMode)).toThrow(/elastic-gas/)
  })
})
