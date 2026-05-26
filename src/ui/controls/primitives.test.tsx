import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dialog } from './Dialog'
import { Tabs } from './Tabs'
import { Tooltip } from './Tooltip'
import { TextField } from './TextField'

describe('Dialog', () => {
  it('renders nothing when closed and a labelled modal when open', () => {
    const { rerender } = render(<Dialog open={false} onClose={() => {}} title="Presets">body</Dialog>)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(
      <Dialog open onClose={() => {}} title="Presets" description="Manage saved setups">
        body
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Presets')
  })

  it('closes on Escape, backdrop click, and the close button', () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="T">
        <button>inside</button>
      </Dialog>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    const backdrop = document.querySelector('.dialog__backdrop')
    expect(backdrop).not.toBeNull()
    fireEvent.mouseDown(backdrop as Element)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('moves focus into the dialog on open', () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        <button>first</button>
      </Dialog>,
    )
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })
})

function ControlledTabs() {
  const [value, setValue] = useState('a')
  return (
    <Tabs
      ariaLabel="Sections"
      value={value}
      onChange={setValue}
      tabs={[
        { id: 'a', label: 'Alpha', content: <p>Alpha panel</p> },
        { id: 'b', label: 'Beta', content: <p>Beta panel</p> },
      ]}
    />
  )
}

describe('Tabs', () => {
  it('exposes ARIA roles and switches panel on click', () => {
    render(<ControlledTabs />)
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument()
    expect(screen.getByText('Alpha panel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(screen.getByText('Beta panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves between tabs with arrow keys', () => {
    render(<ControlledTabs />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Tooltip', () => {
  it('shows on focus and links the trigger via aria-describedby', async () => {
    render(
      <Tooltip label="Helpful hint">
        <button>action</button>
      </Tooltip>,
    )
    const button = screen.getByRole('button', { name: 'action' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(button)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Helpful hint')
    expect(button).toHaveAttribute('aria-describedby', tip.id)
    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('TextField', () => {
  it('associates the label and reports typed text', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [v, setV] = useState('')
      return <TextField label="Preset name" value={v} onChange={setV} />
    }
    render(<Controlled />)
    const input = screen.getByLabelText('Preset name')
    await user.type(input, 'Galaxy')
    expect(input).toHaveValue('Galaxy')
  })
})
