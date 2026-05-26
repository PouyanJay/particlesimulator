import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from './ViewToggle'
import { useParamStore } from '../state/paramStore'

beforeEach(() => useParamStore.setState({ view: '3d' }))

describe('ViewToggle', () => {
  it('reflects the current projection and switches it', () => {
    render(<ViewToggle />)
    const threeD = screen.getByRole('button', { name: '3D' })
    const twoD = screen.getByRole('button', { name: '2D' })
    expect(threeD).toHaveAttribute('aria-pressed', 'true')
    expect(twoD).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(twoD)
    expect(useParamStore.getState().view).toBe('2d')
    expect(twoD).toHaveAttribute('aria-pressed', 'true')
  })
})
