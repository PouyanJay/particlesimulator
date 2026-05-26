import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'
import type { Command } from './commandModel'

function makeCommands(run: Record<string, () => void> = {}): Command[] {
  return [
    { id: 'play', title: 'Play / Pause', group: 'Playback', run: run.play ?? (() => {}) },
    { id: 'reset', title: 'Reset simulation', group: 'Playback', run: run.reset ?? (() => {}) },
    { id: 'share', title: 'Copy share link', group: 'Scenario', run: run.share ?? (() => {}) },
  ]
}

describe('CommandPalette', () => {
  it('is not rendered when closed', () => {
    render(<CommandPalette open={false} onClose={() => {}} commands={makeCommands()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists commands and filters them by query', () => {
    render(<CommandPalette open onClose={() => {}} commands={makeCommands()} />)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Search commands'), { target: { value: 'share' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Copy share link')
  })

  it('runs the highlighted command on Enter and closes', () => {
    const share = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open onClose={onClose} commands={makeCommands({ share })} />)
    const input = screen.getByLabelText('Search commands')
    fireEvent.change(input, { target: { value: 'share' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(share).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves the active option with arrow keys', () => {
    const reset = vi.fn()
    render(<CommandPalette open onClose={() => {}} commands={makeCommands({ reset })} />)
    const input = screen.getByLabelText('Search commands')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // 0 → 1 (Reset)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<CommandPalette open onClose={onClose} commands={makeCommands()} />)
    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
