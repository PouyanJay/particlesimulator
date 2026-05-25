import { describe, it, expect, beforeEach } from 'vitest'
import { useTelemetryStore, TELEMETRY_HISTORY_LIMIT } from './telemetryStore'

beforeEach(() => useTelemetryStore.getState().reset())

describe('telemetryStore', () => {
  it('starts empty', () => {
    expect(useTelemetryStore.getState().current).toBeNull()
    expect(useTelemetryStore.getState().speedHistory).toEqual([])
  })

  it('push records the latest telemetry and appends to the speed history', () => {
    useTelemetryStore.getState().push({ particleCount: 10, averageSpeed: 1.5, kineticEnergy: 5 })
    expect(useTelemetryStore.getState().current?.averageSpeed).toBe(1.5)
    expect(useTelemetryStore.getState().speedHistory).toEqual([1.5])
  })

  it('caps the speed history at the configured limit, keeping the most recent', () => {
    const { push } = useTelemetryStore.getState()
    for (let i = 0; i < TELEMETRY_HISTORY_LIMIT + 50; i++) {
      push({ particleCount: 1, averageSpeed: i, kineticEnergy: 0 })
    }
    const history = useTelemetryStore.getState().speedHistory
    expect(history.length).toBe(TELEMETRY_HISTORY_LIMIT)
    expect(history[history.length - 1]).toBe(TELEMETRY_HISTORY_LIMIT + 49)
  })

  it('reset clears current and history', () => {
    useTelemetryStore.getState().push({ particleCount: 1, averageSpeed: 1, kineticEnergy: 1 })
    useTelemetryStore.getState().reset()
    expect(useTelemetryStore.getState().current).toBeNull()
    expect(useTelemetryStore.getState().speedHistory).toEqual([])
  })
})
