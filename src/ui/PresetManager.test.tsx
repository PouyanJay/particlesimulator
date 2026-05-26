import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresetManager } from './PresetManager'
import { useUiStore } from '../state/uiStore'
import { usePresetStore } from '../state/presetStore'
import { useParamStore } from '../state/paramStore'

beforeEach(() => {
  usePresetStore.setState({ presets: [] })
  useUiStore.setState({ overlay: 'presets' })
  useParamStore.setState({
    modeId: 'boids',
    seed: 9,
    params: { particleCount: 50 },
    substanceId: 'reduced',
    view: '3d',
    isPlaying: true,
  })
})

describe('PresetManager', () => {
  it('saves the current setup as a named preset and lists it', async () => {
    const user = userEvent.setup()
    render(<PresetManager />)
    await user.type(screen.getByLabelText('Save current setup as'), 'My flock')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(usePresetStore.getState().presets[0].name).toBe('My flock')
    expect(screen.getByText('My flock')).toBeInTheDocument()
  })

  it('restores a saved scenario when its row is clicked', async () => {
    const user = userEvent.setup()
    render(<PresetManager />)
    await user.type(screen.getByLabelText('Save current setup as'), 'Snapshot')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Change the live scenario, then load the preset back.
    useParamStore.setState({ modeId: 'elastic-gas', params: { particleCount: 999 } })
    fireEvent.click(screen.getByRole('button', { name: 'Load Snapshot' }))

    expect(useParamStore.getState().modeId).toBe('boids')
    expect(useParamStore.getState().params.particleCount).toBe(50)
    expect(useUiStore.getState().overlay).toBe('none') // dialog closed after load
  })

  it('deletes a preset', async () => {
    const user = userEvent.setup()
    render(<PresetManager />)
    await user.type(screen.getByLabelText('Save current setup as'), 'Trash me')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Delete Trash me' }))
    expect(usePresetStore.getState().presets).toHaveLength(0)
  })
})
