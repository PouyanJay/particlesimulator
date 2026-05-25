import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MeasurementReadouts } from './MeasurementReadouts'
import { useTelemetryStore } from '../state/telemetryStore'

beforeEach(() => useTelemetryStore.getState().reset())

describe('MeasurementReadouts', () => {
  it('shows an empty state before the sim has produced telemetry', () => {
    render(<MeasurementReadouts />)
    expect(screen.getByText(/run the simulation to measure/i)).toBeInTheDocument()
  })

  it('always shows kinetic energy once telemetry exists', () => {
    useTelemetryStore.getState().push({ particleCount: 10, averageSpeed: 1, kineticEnergy: 12.5 })
    render(<MeasurementReadouts />)
    expect(screen.getByText('Kinetic energy')).toBeInTheDocument()
    expect(screen.getByText('12.50')).toBeInTheDocument()
  })

  it('shows temperature, pressure, and total momentum only when the mode reports them', () => {
    useTelemetryStore.getState().push({
      particleCount: 10,
      averageSpeed: 1,
      kineticEnergy: 5,
      temperature: 0.8,
      pressure: 0.25,
      momentum: [3, 0, 4], // |p| = 5
    })
    render(<MeasurementReadouts />)
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText('0.800')).toBeInTheDocument()
    expect(screen.getByText('Pressure')).toBeInTheDocument()
    expect(screen.getByText('Total momentum')).toBeInTheDocument()
    expect(screen.getByText('5.000')).toBeInTheDocument() // hypot(3,0,4)
  })

  it('omits gas-only quantities for a mode that does not report them', () => {
    useTelemetryStore.getState().push({ particleCount: 10, averageSpeed: 1, kineticEnergy: 5 })
    render(<MeasurementReadouts />)
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
    expect(screen.queryByText('Pressure')).not.toBeInTheDocument()
    expect(screen.queryByText('Total momentum')).not.toBeInTheDocument()
  })

  it('renders values as bare dimensionless numbers with a reduced-units note', () => {
    useTelemetryStore.getState().push({
      particleCount: 10,
      averageSpeed: 1,
      kineticEnergy: 12.5,
      temperature: 0.8,
      pressure: 0.25,
      momentum: [3, 0, 4],
    })
    render(<MeasurementReadouts />)
    // Bare numbers — no SI/reduced unit suffix on any value.
    expect(screen.getByText('12.50')).toBeInTheDocument()
    expect(screen.getByText('0.800')).toBeInTheDocument()
    expect(screen.getByText('5.000')).toBeInTheDocument() // hypot(3,0,4)
    expect(screen.getByText(/dimensionless reduced units/i)).toBeInTheDocument()
  })

  it('flags an inelastic run', () => {
    useTelemetryStore.getState().push({ particleCount: 10, averageSpeed: 1, kineticEnergy: 5, inelastic: true })
    render(<MeasurementReadouts />)
    expect(screen.getByText(/not conserved/i)).toBeInTheDocument()
  })
})
