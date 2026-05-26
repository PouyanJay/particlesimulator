import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './uiStore'

beforeEach(() => useUiStore.setState({ overlay: 'none' }))

describe('uiStore', () => {
  it('opens and closes overlays', () => {
    useUiStore.getState().openOverlay('presets')
    expect(useUiStore.getState().overlay).toBe('presets')
    useUiStore.getState().closeOverlay()
    expect(useUiStore.getState().overlay).toBe('none')
  })

  it('toggleOverlay opens, then closes when toggled with the same overlay', () => {
    useUiStore.getState().toggleOverlay('palette')
    expect(useUiStore.getState().overlay).toBe('palette')
    useUiStore.getState().toggleOverlay('palette')
    expect(useUiStore.getState().overlay).toBe('none')
  })

  it('toggleOverlay switches directly between overlays', () => {
    useUiStore.getState().toggleOverlay('palette')
    useUiStore.getState().toggleOverlay('share')
    expect(useUiStore.getState().overlay).toBe('share')
  })
})
