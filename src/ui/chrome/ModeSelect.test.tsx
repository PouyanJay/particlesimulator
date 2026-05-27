import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeSelect } from './ModeSelect'
import { useParamStore } from '../../state/paramStore'

beforeEach(() => useParamStore.getState().selectMode('elastic-gas'))

describe('ModeSelect', () => {
  it('lists the registered modes once the menu is opened', async () => {
    render(<ModeSelect />)
    await userEvent.click(screen.getByRole('button', { name: 'Simulation mode' }))
    expect(screen.getByRole('menuitem', { name: 'Elastic Gas' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Particle Life' })).toBeInTheDocument()
  })

  it('selecting a mode updates the store and loads the new mode defaults', async () => {
    render(<ModeSelect />)
    await userEvent.click(screen.getByRole('button', { name: 'Simulation mode' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Particle Life' }))
    expect(useParamStore.getState().modeId).toBe('particle-life')
    // Params reset to the selected mode's schema defaults.
    expect(useParamStore.getState().params.numTypes).toBe(4)
  })

  it('closes the menu after a selection', async () => {
    render(<ModeSelect />)
    await userEvent.click(screen.getByRole('button', { name: 'Simulation mode' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Particle Life' }))
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})
