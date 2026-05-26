import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EquationPanel } from './EquationPanel'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'

beforeEach(() => {
  useTelemetryStore.getState().reset()
  useParamStore.getState().selectMode('elastic-gas')
})

describe('EquationPanel', () => {
  it('shows the ideal-gas law for a gas mode', () => {
    render(<EquationPanel />)
    expect(screen.getByText(/Governing law/i)).toBeInTheDocument()
    expect(screen.getByText(/ideal-gas law/i)).toBeInTheDocument()
  })

  it('evaluates both sides of P·V = N·k_B·T live from telemetry', () => {
    useTelemetryStore.getState().push({
      particleCount: 100,
      averageSpeed: 1,
      kineticEnergy: 50,
      temperature: 1.5,
      pressure: 2,
      volume: 75, // P·V = 150
    })
    render(<EquationPanel />)
    // P·V = 2·75 = 150.00 ; N·k_B·T = 100·1.5 = 150.00 (k_B = 1)
    expect(screen.getAllByText('150.00')).toHaveLength(2)
  })

  it('shows Newton gravitation for N-body and Coulomb for electrostatics', () => {
    // Set the id directly — electrostatics may not be registered on this branch yet.
    useParamStore.setState({ modeId: 'nbody' })
    const { rerender } = render(<EquationPanel />)
    expect(screen.getByText(/Newton's law of universal gravitation/i)).toBeInTheDocument()

    useParamStore.setState({ modeId: 'electrostatics' })
    rerender(<EquationPanel />)
    expect(screen.getByText(/Coulomb's law/i)).toBeInTheDocument()
  })
})
