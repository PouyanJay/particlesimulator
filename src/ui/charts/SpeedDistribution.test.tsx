import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpeedDistribution } from './SpeedDistribution'
import { useTelemetryStore } from '../../state/telemetryStore'

beforeEach(() => useTelemetryStore.getState().reset())

describe('SpeedDistribution', () => {
  it('shows an empty state when there are no speed samples', () => {
    render(<SpeedDistribution />)
    expect(screen.getByText(/no speed data/i)).toBeInTheDocument()
  })

  it('renders histogram bars and the analytic curve when samples are present', () => {
    useTelemetryStore.getState().push({
      particleCount: 5,
      averageSpeed: 1.5,
      kineticEnergy: 1,
      speedSamples: new Float32Array([0.5, 1, 1.5, 2, 2.5]),
    })
    const { container } = render(<SpeedDistribution />)
    expect(container.querySelectorAll('rect.distribution__bar').length).toBeGreaterThan(0)
    expect(container.querySelector('polyline.distribution__curve')).not.toBeNull()
  })
})
