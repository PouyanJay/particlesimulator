import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ControlPanel } from './ControlPanel'
import { useParamStore } from '../../state/paramStore'

beforeEach(() => useParamStore.getState().selectMode('elastic-gas'))

describe('ControlPanel', () => {
  it('renders a labelled control for every parameter in the active mode schema', () => {
    render(<ControlPanel />)
    expect(screen.getByLabelText('Particle Count')).toBeInTheDocument()
    expect(screen.getByLabelText('Initial Velocity')).toBeInTheDocument()
    expect(screen.getByLabelText('Restitution')).toBeInTheDocument()
    expect(screen.getByLabelText('Gravity')).toBeInTheDocument() // now a strength slider
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
})
