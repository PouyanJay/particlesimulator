import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GasLawPanel } from './GasLawPanel'
import { useParamStore } from '../../state/paramStore'
import { useTelemetryStore } from '../../state/telemetryStore'

beforeEach(() => {
  useTelemetryStore.getState().reset()
  useParamStore.getState().selectMode('molecular-dynamics')
})

const pushGas = (pressure: number, volume: number, particleCount: number, temperature: number) =>
  useTelemetryStore.getState().push({ particleCount, averageSpeed: 1, kineticEnergy: 1, pressure, volume, temperature })

describe('GasLawPanel', () => {
  it('renders nothing until pressure has been measured', () => {
    const { container } = render(<GasLawPanel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a non-gas mode', () => {
    useParamStore.setState({ modeId: 'nbody' })
    pushGas(2, 75, 100, 1.5)
    const { container } = render(<GasLawPanel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows P·V, N·k_B·T, Z = 1 and 0% deviation when the gas is ideal', () => {
    pushGas(2, 75, 100, 1.5) // P·V = 150, N·k_B·T = 150 ⇒ Z = 1.000, 0%
    render(<GasLawPanel />)
    expect(screen.getAllByText('150.00')).toHaveLength(2) // both sides
    expect(screen.getByText('1.000')).toBeInTheDocument() // Z
    expect(screen.getByText('+0.0%')).toBeInTheDocument() // deviation
  })

  it('reports Z < 1 and a negative deviation when P·V is below N·k·T', () => {
    pushGas(1, 75, 100, 1.5) // P·V = 75 vs 150 ⇒ Z = 0.500, −50%
    render(<GasLawPanel />)
    expect(screen.getByText('0.500')).toBeInTheDocument() // Z
    expect(screen.getByText('-50.0%')).toBeInTheDocument()
  })

  it('grades the deviation colour: neutral < 20%, orange > 20%, red > 40%', () => {
    const deviationClass = () => screen.getByText(/%$/).className

    // ~10% deviation (P·V = 165 vs 150) → no severity modifier.
    pushGas(2.2, 75, 100, 1.5)
    const neutral = render(<GasLawPanel />)
    expect(deviationClass()).not.toMatch(/gaslaw__value--(warn|danger)/)
    neutral.unmount()

    // ~30% deviation (P·V = 195 vs 150) → orange (warn).
    useTelemetryStore.getState().reset()
    pushGas(2.6, 75, 100, 1.5)
    const warn = render(<GasLawPanel />)
    expect(deviationClass()).toMatch(/gaslaw__value--warn/)
    warn.unmount()

    // 50% deviation → red (danger).
    useTelemetryStore.getState().reset()
    pushGas(1, 75, 100, 1.5)
    render(<GasLawPanel />)
    expect(deviationClass()).toMatch(/gaslaw__value--danger/)
  })
})
