import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from './Toolbar'
import { useParamStore } from '../../state/paramStore'

// The record button delegates to the shared toggle; mock it so the toolbar can be tested in
// isolation from the recording engine.
const rt = vi.hoisted(() => ({ recording: false, toggle: vi.fn() }))
vi.mock('../hooks/useRecordToggle', () => ({
  useRecordToggle: () => ({ recording: rt.recording, format: 'mp4', error: null, toggle: rt.toggle }),
}))

beforeEach(() => {
  rt.recording = false
  rt.toggle.mockClear()
  useParamStore.setState({ isPlaying: false })
})

describe('Toolbar', () => {
  it('shows a record button beside play that starts recording on click', () => {
    render(<Toolbar />)
    const rec = screen.getByRole('button', { name: 'Start recording (MP4)' })
    expect(rec).toHaveAttribute('aria-pressed', 'false')
    // The persisted format is surfaced in the tooltip too.
    expect(rec).toHaveAttribute('title', 'Record (MP4)')
    fireEvent.click(rec)
    expect(rt.toggle).toHaveBeenCalledTimes(1)
  })

  it('shows a stop button while recording', () => {
    rt.recording = true
    render(<Toolbar />)
    const stop = screen.getByRole('button', { name: 'Stop recording' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
  })

  it('still toggles play/pause independently of recording', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(useParamStore.getState().isPlaying).toBe(true)
  })
})
