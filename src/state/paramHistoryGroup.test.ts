import { describe, it, expect, beforeEach } from 'vitest'
import { useParamStore } from './paramStore'
import { beginParamHistoryGroup, endParamHistoryGroup } from './paramHistoryGroup'

const temporal = () => useParamStore.temporal.getState()

beforeEach(() => {
  useParamStore.setState({
    modeId: 'elastic-gas',
    seed: 1,
    params: { particleCount: 200 },
    substanceId: 'reduced',
    view: '3d',
    isPlaying: true,
  })
  temporal().clear()
  endParamHistoryGroup() // defensively clear any dangling group from a prior test
  temporal().clear()
})

describe('param history group (slider-drag coalescing)', () => {
  it('collapses many edits between begin/end into a single undo step', () => {
    beginParamHistoryGroup()
    useParamStore.getState().setParam('particleCount', 210)
    useParamStore.getState().setParam('particleCount', 220)
    useParamStore.getState().setParam('particleCount', 230)
    expect(temporal().pastStates.length).toBe(0) // nothing recorded mid-drag
    endParamHistoryGroup()

    expect(temporal().pastStates.length).toBe(1)
    expect(useParamStore.getState().params.particleCount).toBe(230)
    temporal().undo()
    expect(useParamStore.getState().params.particleCount).toBe(200) // one undo reverts the whole drag
  })

  it('records nothing when the group ends with no net change', () => {
    beginParamHistoryGroup()
    // a click that doesn't move the value, or a drag that returns to start
    useParamStore.getState().setParam('particleCount', 250)
    useParamStore.getState().setParam('particleCount', 200)
    endParamHistoryGroup()
    expect(temporal().pastStates.length).toBe(0)
  })

  it('resumes normal per-edit recording after the group ends', () => {
    beginParamHistoryGroup()
    useParamStore.getState().setParam('particleCount', 300)
    endParamHistoryGroup()
    useParamStore.getState().setParam('particleCount', 400)
    expect(temporal().pastStates.length).toBe(2)
    temporal().undo()
    expect(useParamStore.getState().params.particleCount).toBe(300)
  })

  it('clears the redo stack when a new group is committed', () => {
    useParamStore.getState().setParam('particleCount', 300)
    temporal().undo()
    expect(temporal().futureStates.length).toBe(1)
    beginParamHistoryGroup()
    useParamStore.getState().setParam('particleCount', 500)
    endParamHistoryGroup()
    expect(temporal().futureStates.length).toBe(0)
  })
})
