import { describe, it, expect } from 'vitest'
import { simRegistry } from './simRegistry'

describe('simRegistry', () => {
  it('registers the elastic gas, particle life, n-body, and GPU n-body modes', () => {
    const ids = simRegistry.list().map((m) => m.id)
    expect(ids).toContain('elastic-gas')
    expect(ids).toContain('particle-life')
    expect(ids).toContain('nbody')
    expect(ids).toContain('nbody-gpu')
    expect(ids).toContain('spring-mass')
    expect(ids).toContain('xpbd-cloth')
    expect(ids).toContain('rigid-bodies')
  })

  it('exposes each mode backend for render dispatch', () => {
    const byId = Object.fromEntries(simRegistry.list().map((m) => [m.id, m.backend]))
    expect(byId['elastic-gas']).toBe('cpu')
    expect(byId['nbody-gpu']).toBe('webgpu-compute')
    expect(byId['rigid-bodies']).toBe('rapier')
  })

  it('can create the registered modes', () => {
    expect(simRegistry.create('elastic-gas').id).toBe('elastic-gas')
    expect(simRegistry.create('particle-life').id).toBe('particle-life')
    expect(simRegistry.create('nbody').id).toBe('nbody')
    expect(simRegistry.create('nbody-gpu').id).toBe('nbody-gpu')
  })
})
