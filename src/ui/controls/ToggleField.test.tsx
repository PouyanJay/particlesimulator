import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleField } from './ToggleField'

// Shared boolean-param primitive. No mode currently uses a boolean param (gravity became a
// strength slider), so it is covered directly here rather than through the control panel.
describe('ToggleField', () => {
  it('renders a labelled switch reflecting the checked state', () => {
    render(<ToggleField label="Gravity" checked onChange={() => {}} />)
    const sw = screen.getByRole('switch', { name: 'Gravity' })
    expect(sw).toBeChecked()
  })

  it('reports the new value on toggle', async () => {
    const onChange = vi.fn()
    render(<ToggleField label="Gravity" checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Gravity' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
