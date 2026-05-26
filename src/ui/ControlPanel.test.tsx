import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ControlPanel } from './ControlPanel'
import { useParamStore } from '../state/paramStore'

beforeEach(() => useParamStore.getState().selectMode('elastic-gas'))

describe('ControlPanel', () => {
  it('renders a labelled control for every parameter in the active mode schema', () => {
    render(<ControlPanel />)
    // Number params become sliders, the boolean param becomes a switch.
    expect(screen.getByLabelText('Particle Count')).toBeInTheDocument()
    expect(screen.getByLabelText('Initial Velocity')).toBeInTheDocument()
    expect(screen.getByLabelText('Restitution')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Gravity' })).toBeInTheDocument()
  })

  it('groups parameters into Scene and Dynamics sections', () => {
    render(<ControlPanel />)
    expect(screen.getByRole('heading', { name: 'Scene' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dynamics' })).toBeInTheDocument()
    // Universal setup (Particle Count) is scene; the physics (Restitution) is dynamics.
    expect(screen.getByLabelText('Particle Count')).toBeInTheDocument()
    expect(screen.getByLabelText('Restitution')).toBeInTheDocument()
  })

  it('writes slider changes to the param store', () => {
    render(<ControlPanel />)
    const slider = screen.getByLabelText('Particle Count')
    fireEvent.change(slider, { target: { value: '300' } })
    expect(useParamStore.getState().params.particleCount).toBe(300)
  })

  it('writes toggle changes to the param store', async () => {
    render(<ControlPanel />)
    expect(useParamStore.getState().params.gravity).toBe(false)
    await userEvent.click(screen.getByRole('switch', { name: 'Gravity' }))
    expect(useParamStore.getState().params.gravity).toBe(true)
  })
})
