import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MeasurementReadouts } from './MeasurementReadouts'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useParamStore } from '../../state/paramStore'

beforeEach(() => {
  useTelemetryStore.getState().reset()
  // Isolate each test: default to a non-LJ mode in reduced (dimensionless) units.
  useParamStore.getState().selectMode('elastic-gas')
  useParamStore.getState().setSubstance('reduced')
})

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

  it('renders bare dimensionless numbers with a reduced-units note by default', () => {
    useTelemetryStore.getState().push({
      particleCount: 10,
      averageSpeed: 1,
      kineticEnergy: 12.5,
      temperature: 0.8,
      pressure: 0.25,
      momentum: [3, 0, 4],
    })
    render(<MeasurementReadouts />)
    expect(screen.getByText('12.50')).toBeInTheDocument()
    expect(screen.getByText('0.800')).toBeInTheDocument()
    expect(screen.getByText(/dimensionless reduced units/i)).toBeInTheDocument()
  })

  it('flags an inelastic run', () => {
    useTelemetryStore.getState().push({ particleCount: 10, averageSpeed: 1, kineticEnergy: 5, inelastic: true })
    render(<MeasurementReadouts />)
    expect(screen.getByText(/not conserved/i)).toBeInTheDocument()
  })

  it('converts readouts to SI for a real substance on the Lennard-Jones gas', () => {
    useParamStore.getState().selectMode('molecular-dynamics')
    useParamStore.getState().setSubstance('argon')
    useTelemetryStore.getState().push({
      particleCount: 10,
      averageSpeed: 1,
      kineticEnergy: 1,
      temperature: 1.2,
      pressure: 0.01,
      momentum: [0, 0, 0],
    })
    render(<MeasurementReadouts />)
    // Argon ε/k_B = 119.8 K ⇒ T* = 1.2 → 143.8 K, with the unit in the label.
    expect(screen.getByText('Temperature (K)')).toBeInTheDocument()
    expect(screen.getByText('143.8')).toBeInTheDocument()
    expect(screen.getByText('Kinetic energy (J)')).toBeInTheDocument()
    expect(screen.getByText(/argon · si units/i)).toBeInTheDocument()
  })
})
