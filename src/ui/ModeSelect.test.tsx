import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeSelect } from './ModeSelect'
import { useParamStore } from '../state/paramStore'

beforeEach(() => useParamStore.getState().selectMode('elastic-gas'))

describe('ModeSelect', () => {
  it('lists the registered modes as options', () => {
    render(<ModeSelect />)
    expect(screen.getByRole('option', { name: 'Elastic Gas' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Particle Life' })).toBeInTheDocument()
  })

  it('switching the mode updates the store and loads the new mode defaults', async () => {
    render(<ModeSelect />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Simulation mode' }), 'particle-life')
    expect(useParamStore.getState().modeId).toBe('particle-life')
    // Params reset to the selected mode's schema defaults.
    expect(useParamStore.getState().params.numTypes).toBe(4)
  })
})
