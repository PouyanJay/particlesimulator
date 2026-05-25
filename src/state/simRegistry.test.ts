import { describe, it, expect } from 'vitest'
import { simRegistry } from './simRegistry'

describe('simRegistry', () => {
  it('registers the elastic gas mode', () => {
    expect(simRegistry.has('elastic-gas')).toBe(true)
    expect(simRegistry.list().map((m) => m.id)).toContain('elastic-gas')
  })

  it('can create the registered mode', () => {
    expect(simRegistry.create('elastic-gas').id).toBe('elastic-gas')
  })
})
