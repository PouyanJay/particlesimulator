import { describe, it, expect } from 'vitest'
import { MODE_EXPLAINERS, explainerFor } from './modeExplainers'
import { simRegistry } from '../state/simRegistry'

describe('mode explainers', () => {
  it('has a non-trivial explainer for every registered mode', () => {
    for (const mode of simRegistry.list()) {
      const text = explainerFor(mode.id)
      expect(text, `missing explainer for "${mode.id}"`).toBeTruthy()
      expect((text ?? '').length).toBeGreaterThan(30)
    }
  })

  it('has no explainers for modes that no longer exist', () => {
    const ids = new Set(simRegistry.list().map((m) => m.id))
    for (const id of Object.keys(MODE_EXPLAINERS)) {
      expect(ids.has(id), `stale explainer for "${id}"`).toBe(true)
    }
  })
})
