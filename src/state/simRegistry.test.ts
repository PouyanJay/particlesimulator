import { describe, it, expect } from 'vitest'
import { simRegistry } from './simRegistry'

describe('simRegistry', () => {
  it('registers the elastic gas, particle life, and n-body modes', () => {
    const ids = simRegistry.list().map((m) => m.id)
    expect(ids).toContain('elastic-gas')
    expect(ids).toContain('particle-life')
    expect(ids).toContain('nbody')
  })

  it('can create the registered modes', () => {
    expect(simRegistry.create('elastic-gas').id).toBe('elastic-gas')
    expect(simRegistry.create('particle-life').id).toBe('particle-life')
    expect(simRegistry.create('nbody').id).toBe('nbody')
  })
})
