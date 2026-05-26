// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useParamStore } from './paramStore'
import { useParamHistory } from './useParamHistory'

const temporal = () => useParamStore.temporal.getState()

beforeEach(() => {
  // Start from a known scenario with empty history.
  useParamStore.setState({
    modeId: 'elastic-gas',
    seed: 1,
    params: { particleCount: 200 },
    substanceId: 'reduced',
    view: '3d',
    isPlaying: true,
  })
  temporal().clear()
})

describe('param undo/redo (zundo temporal)', () => {
  it('undo restores the previous value and redo re-applies it', () => {
    useParamStore.getState().setParam('particleCount', 300)
    useParamStore.getState().setParam('particleCount', 400)
    expect(useParamStore.getState().params.particleCount).toBe(400)

    temporal().undo()
    expect(useParamStore.getState().params.particleCount).toBe(300)
    temporal().undo()
    expect(useParamStore.getState().params.particleCount).toBe(200)
    temporal().redo()
    expect(useParamStore.getState().params.particleCount).toBe(300)
  })

  it('never records a play/pause toggle (transient, not scenario-defining)', () => {
    useParamStore.getState().togglePlaying()
    useParamStore.getState().togglePlaying()
    expect(temporal().pastStates.length).toBe(0)
  })

  it('leaves playback state untouched when undoing a param change', () => {
    useParamStore.getState().setPlaying(false)
    useParamStore.getState().setParam('particleCount', 300)
    temporal().undo()
    expect(useParamStore.getState().params.particleCount).toBe(200)
    expect(useParamStore.getState().isPlaying).toBe(false)
  })

  it('undoing a mode switch restores the previous mode and its params together', () => {
    useParamStore.getState().selectMode('boids')
    expect(useParamStore.getState().modeId).toBe('boids')
    temporal().undo()
    expect(useParamStore.getState().modeId).toBe('elastic-gas')
    expect(useParamStore.getState().params.particleCount).toBe(200)
  })

  it('useParamHistory exposes canUndo/canRedo flags that track history', () => {
    const { result } = renderHook(() => useParamHistory())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    act(() => {
      useParamStore.getState().setParam('particleCount', 999)
    })
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })
})
