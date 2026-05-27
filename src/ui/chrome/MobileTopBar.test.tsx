import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTopBar } from './MobileTopBar'
import { useParamStore } from '../../state/paramStore'
import { useUiStore } from '../../state/uiStore'

beforeEach(() => {
  useUiStore.setState({ overlay: 'none' })
})

describe('MobileTopBar', () => {
  it('shows the brand', () => {
    render(<MobileTopBar />)
    expect(screen.getByText(/Particle/i)).toBeInTheDocument()
  })

  it('resets the simulation with new initial conditions', () => {
    const spy = vi.spyOn(useParamStore.getState(), 'randomizeSeed')
    render(<MobileTopBar />)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('opens the command palette from the More button', () => {
    render(<MobileTopBar />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(useUiStore.getState().overlay).toBe('palette')
  })
})
