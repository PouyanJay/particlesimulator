import { describe, it, expect, beforeEach } from 'vitest'
import { useParamStore, mergePersistedState, scenarioFromState } from './paramStore'
import { defaultParamValues } from '../sim-core/paramSchema'
import { simRegistry } from './simRegistry'
import type { Scenario } from '../sim-core/scenario'

const gasDefaults = defaultParamValues(simRegistry.create('elastic-gas').paramSchema)

beforeEach(() => {
  const s = useParamStore.getState()
  s.selectMode('elastic-gas')
  s.setSeed(1)
  s.setPlaying(true)
})

describe('paramStore', () => {
  it('initialises to the elastic-gas mode with its default params', () => {
    const s = useParamStore.getState()
    expect(s.modeId).toBe('elastic-gas')
    expect(s.params).toEqual(gasDefaults)
    expect(s.isPlaying).toBe(true)
  })

  it('setParam updates one parameter and leaves the rest untouched', () => {
    useParamStore.getState().setParam('particleCount', 350)
    expect(useParamStore.getState().params.particleCount).toBe(350)
    expect(useParamStore.getState().params.restitution).toBe(gasDefaults.restitution)
  })

  it('resetParams restores the mode defaults', () => {
    useParamStore.getState().setParam('particleCount', 350)
    useParamStore.getState().resetParams()
    expect(useParamStore.getState().params).toEqual(gasDefaults)
  })

  it('selectMode resets params to the selected mode defaults', () => {
    useParamStore.getState().setParam('particleCount', 999)
    useParamStore.getState().selectMode('elastic-gas')
    expect(useParamStore.getState().params).toEqual(gasDefaults)
  })

  it('setSeed sets the seed and randomizeSeed produces a different non-negative integer', () => {
    useParamStore.getState().setSeed(7)
    expect(useParamStore.getState().seed).toBe(7)
    useParamStore.getState().randomizeSeed()
    const seed = useParamStore.getState().seed
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).not.toBe(7)
  })

  it('togglePlaying flips the play state', () => {
    const before = useParamStore.getState().isPlaying
    useParamStore.getState().togglePlaying()
    expect(useParamStore.getState().isPlaying).toBe(!before)
  })

  it('defaults to the 3D view and setView switches projection', () => {
    expect(useParamStore.getState().view).toBe('3d')
    useParamStore.getState().setView('2d')
    expect(useParamStore.getState().view).toBe('2d')
  })

  it('loadScenario applies mode + params + seed + substance + view atomically (no reset to defaults)', () => {
    const scenario: Scenario = {
      modeId: 'boids',
      seed: 123,
      params: { particleCount: 77 },
      substanceId: 'reduced',
      view: '2d',
    }
    useParamStore.getState().loadScenario(scenario)
    const s = useParamStore.getState()
    expect(s.modeId).toBe('boids')
    expect(s.seed).toBe(123)
    expect(s.params).toEqual({ particleCount: 77 }) // kept verbatim, not reset to boids defaults
    expect(s.substanceId).toBe('reduced')
    expect(s.view).toBe('2d')
  })

  it('loadScenario defaults substance to reduced and view to 3d when omitted', () => {
    useParamStore.getState().setSubstance('argon')
    useParamStore.getState().setView('2d')
    useParamStore.getState().loadScenario({ modeId: 'elastic-gas', seed: 5, params: { particleCount: 10 } })
    const s = useParamStore.getState()
    expect(s.substanceId).toBe('reduced')
    expect(s.view).toBe('3d')
  })

  it('scenarioFromState captures the current scenario (camera optional)', () => {
    useParamStore.getState().loadScenario({ modeId: 'boids', seed: 9, params: { particleCount: 30 } })
    const scenario = scenarioFromState(useParamStore.getState())
    expect(scenario).toEqual({
      modeId: 'boids',
      seed: 9,
      params: { particleCount: 30 },
      substanceId: 'reduced',
      view: '3d',
    })
    const withCamera = scenarioFromState(useParamStore.getState(), {
      position: [1, 2, 3],
      target: [0, 0, 0],
    })
    expect(withCamera.camera).toEqual({ position: [1, 2, 3], target: [0, 0, 0] })
  })
})

describe('mergePersistedState — rehydration resilience', () => {
  const current = useParamStore.getState()

  it('keeps a valid persisted scenario', () => {
    const merged = mergePersistedState(
      { modeId: 'boids', seed: 9, params: { particleCount: 42 }, substanceId: 'reduced' },
      current,
    )
    expect(merged.modeId).toBe('boids')
    expect(merged.seed).toBe(9)
    expect(merged.params).toEqual({ particleCount: 42 })
  })

  it('falls back to the default mode when the persisted modeId no longer exists', () => {
    // Regression: a removed mode (e.g. a deleted Phase 4 mode) used to crash the app on load —
    // simRegistry.create() throws for an unknown id, blanking the screen.
    expect(simRegistry.has('removed-phase4-mode')).toBe(false)
    const merged = mergePersistedState(
      { modeId: 'removed-phase4-mode', seed: 9, params: { stale: 1 }, substanceId: 'reduced' },
      current,
    )
    expect(merged.modeId).toBe('elastic-gas')
    expect(merged.params).toEqual(gasDefaults) // reset to the default mode's schema, not the stale params
    expect(merged.seed).toBe(9) // unrelated prefs preserved
    expect(merged.substanceId).toBe('reduced')
    // The fallback mode is constructable (this is exactly what would have thrown).
    expect(() => simRegistry.create(merged.modeId)).not.toThrow()
  })

  it('falls back when no modeId was persisted', () => {
    const merged = mergePersistedState({}, current)
    expect(merged.modeId).toBe('elastic-gas')
    expect(merged.params).toEqual(gasDefaults)
  })

  it('keeps the store actions intact after merging', () => {
    const merged = mergePersistedState({ modeId: 'removed', seed: 1, params: {} }, current)
    expect(typeof merged.selectMode).toBe('function')
    expect(typeof merged.setParam).toBe('function')
  })
})
