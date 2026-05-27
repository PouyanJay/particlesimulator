import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('renders a labelled modal dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Settings">
        <p>body</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveClass('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('sheet variant', () => {
    it('renders as a bottom sheet with a drag handle, keeping dialog semantics', () => {
      render(
        <Dialog variant="sheet" open onClose={() => {}} title="Controls">
          <p>params</p>
        </Dialog>,
      )
      const dialog = screen.getByRole('dialog', { name: 'Controls' })
      expect(dialog).toHaveClass('dialog--sheet')
      // The drag handle is a non-interactive affordance at the top of the sheet.
      expect(dialog.querySelector('.dialog__handle')).toBeInTheDocument()
      // Still keyboard-dismissible like any dialog.
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
    })
  })
})
