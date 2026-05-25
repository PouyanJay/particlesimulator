import { describe, it, expect } from 'vitest'
import { clientStorage } from './clientStorage'

// In the node test environment there is no localStorage, so this exercises the
// in-memory fallback that keeps the persist middleware (and SSR/embed) working.
describe('clientStorage', () => {
  it('round-trips values through set/get', () => {
    clientStorage.setItem('k', 'v')
    expect(clientStorage.getItem('k')).toBe('v')
  })

  it('returns null for missing keys', () => {
    expect(clientStorage.getItem('does-not-exist')).toBeNull()
  })

  it('removes values', () => {
    clientStorage.setItem('temp', '1')
    clientStorage.removeItem('temp')
    expect(clientStorage.getItem('temp')).toBeNull()
  })
})
