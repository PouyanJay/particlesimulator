import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useGlobalShortcuts, isInteractiveTarget } from './useGlobalShortcuts'
import { useParamStore } from '../../state/paramStore'

beforeEach(() => {
  useParamStore.setState({
    modeId: 'elastic-gas',
    seed: 1,
    params: { particleCount: 200 },
    substanceId: 'reduced',
    view: '3d',
    isPlaying: true,
  })
  useParamStore.temporal.getState().clear()
})

describe('isInteractiveTarget', () => {
  it('treats text inputs, buttons, selects, and editable regions as interactive', () => {
    const input = document.createElement('input')
    const button = document.createElement('button')
    const select = document.createElement('select')
    expect(isInteractiveTarget(input)).toBe(true)
    expect(isInteractiveTarget(button)).toBe(true)
    expect(isInteractiveTarget(select)).toBe(true)
  })

  it('exempts range sliders so global shortcuts still work there', () => {
    const range = document.createElement('input')
    range.type = 'range'
    expect(isInteractiveTarget(range)).toBe(false)
  })

  it('returns false for the document body / canvas', () => {
    expect(isInteractiveTarget(document.body)).toBe(false)
    expect(isInteractiveTarget(null)).toBe(false)
  })
})

describe('useGlobalShortcuts', () => {
  it('⌘Z undoes and ⇧⌘Z redoes the last scenario change', () => {
    renderHook(() => useGlobalShortcuts())
    useParamStore.getState().setParam('particleCount', 333)
    expect(useParamStore.getState().params.particleCount).toBe(333)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(useParamStore.getState().params.particleCount).toBe(200)

    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    expect(useParamStore.getState().params.particleCount).toBe(333)
  })

  it('Space toggles play/pause when not focused on a control', () => {
    renderHook(() => useGlobalShortcuts())
    expect(useParamStore.getState().isPlaying).toBe(true)
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(useParamStore.getState().isPlaying).toBe(false)
  })

  it('Space does not toggle play when typing in a text field', () => {
    const { getByRole } = render(<input aria-label="name" />)
    const input = getByRole('textbox')
    input.focus()
    renderHook(() => useGlobalShortcuts())
    fireEvent.keyDown(input, { key: ' ' })
    expect(useParamStore.getState().isPlaying).toBe(true)
  })
})
