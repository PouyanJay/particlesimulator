import { describe, it, expect, beforeEach } from 'vitest'
import { useParamStore } from './paramStore'
import { defaultParamValues } from '../sim-core/paramSchema'
import { simRegistry } from './simRegistry'

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
})
