import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from './ViewToggle'
import { useParamStore } from '../state/paramStore'

beforeEach(() => useParamStore.setState({ view: '3d' }))

describe('ViewToggle', () => {
  it('is a radiogroup reflecting the current projection, and switches on click', () => {
    render(<ViewToggle />)
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument()
    const threeD = screen.getByRole('radio', { name: '3D' })
    const twoD = screen.getByRole('radio', { name: '2D' })
    expect(threeD).toHaveAttribute('aria-checked', 'true')
    expect(twoD).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(twoD)
    expect(useParamStore.getState().view).toBe('2d')
    expect(twoD).toHaveAttribute('aria-checked', 'true')
  })

  it('moves selection with arrow keys', () => {
    render(<ViewToggle />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(useParamStore.getState().view).toBe('2d')
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(useParamStore.getState().view).toBe('3d')
  })
})
