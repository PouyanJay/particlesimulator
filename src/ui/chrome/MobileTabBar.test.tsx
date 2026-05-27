import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTabBar } from './MobileTabBar'
import { useParamStore } from '../../state/paramStore'

beforeEach(() => useParamStore.setState({ isPlaying: false }))

describe('MobileTabBar', () => {
  it('toggles the Controls and Measurements sheets', () => {
    const onToggleControls = vi.fn()
    const onToggleMeasurements = vi.fn()
    render(
      <MobileTabBar
        activeSheet={null}
        onToggleControls={onToggleControls}
        onToggleMeasurements={onToggleMeasurements}
      />,
    )

    const controls = screen.getByRole('button', { name: /controls/i })
    const measurements = screen.getByRole('button', { name: /measurements/i })
    expect(controls).toHaveAttribute('aria-pressed', 'false')
    expect(measurements).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(controls)
    expect(onToggleControls).toHaveBeenCalledTimes(1)
    fireEvent.click(measurements)
    expect(onToggleMeasurements).toHaveBeenCalledTimes(1)
  })

  it('reflects which sheet is open via aria-pressed', () => {
    render(
      <MobileTabBar activeSheet="controls" onToggleControls={() => {}} onToggleMeasurements={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /controls/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /measurements/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('plays and pauses the simulation', () => {
    render(
      <MobileTabBar activeSheet={null} onToggleControls={() => {}} onToggleMeasurements={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(useParamStore.getState().isPlaying).toBe(true)
  })
})
