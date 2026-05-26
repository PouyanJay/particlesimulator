import { describe, it, expect } from 'vitest'
import type { Telemetry } from '../sim-core/types'
import { telemetryToCsv, telemetryToJson, type TelemetrySeries } from './telemetrySerialize'

describe('telemetryToCsv', () => {
  it('emits the header followed by one row per sample (equal-length arrays)', () => {
    const series: TelemetrySeries = {
      speedHistory: [1, 2, 3],
      energyHistory: [10, 20, 30],
    }
    expect(telemetryToCsv(series)).toBe(
      'sample,averageSpeed,kineticEnergy\n' +
        '0,1,10\n' +
        '1,2,20\n' +
        '2,3,30\n',
    )
  })

  it('leaves the missing cell empty for ragged arrays (speed shorter)', () => {
    const series: TelemetrySeries = {
      speedHistory: [1],
      energyHistory: [10, 20],
    }
    expect(telemetryToCsv(series)).toBe(
      'sample,averageSpeed,kineticEnergy\n' + '0,1,10\n' + '1,,20\n',
    )
  })

  it('leaves the missing cell empty for ragged arrays (energy shorter)', () => {
    const series: TelemetrySeries = {
      speedHistory: [1, 2],
      energyHistory: [10],
    }
    expect(telemetryToCsv(series)).toBe(
      'sample,averageSpeed,kineticEnergy\n' + '0,1,10\n' + '1,2,\n',
    )
  })

  it('emits only the header (with trailing newline) for empty series', () => {
    const series: TelemetrySeries = { speedHistory: [], energyHistory: [] }
    expect(telemetryToCsv(series)).toBe('sample,averageSpeed,kineticEnergy\n')
  })
})

describe('telemetryToJson', () => {
  it('produces pretty-printed JSON with current, speedHistory and energyHistory', () => {
    const current: Telemetry = {
      particleCount: 2,
      averageSpeed: 5,
      kineticEnergy: 50,
    }
    const series: TelemetrySeries = { speedHistory: [1, 2], energyHistory: [10, 20] }
    const json = telemetryToJson(series, current)

    // pretty-printed → contains 2-space indentation
    expect(json).toContain('\n  ')

    const parsed = JSON.parse(json)
    expect(parsed.current).toEqual(current)
    expect(parsed.speedHistory).toEqual([1, 2])
    expect(parsed.energyHistory).toEqual([10, 20])
  })

  it('converts Float32Array fields in current to plain number arrays', () => {
    const current: Telemetry = {
      particleCount: 3,
      averageSpeed: 5,
      kineticEnergy: 50,
      speedSamples: new Float32Array([1, 2, 3]),
    }
    const series: TelemetrySeries = { speedHistory: [], energyHistory: [] }
    const json = telemetryToJson(series, current)

    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed.current.speedSamples)).toBe(true)
    expect(parsed.current.speedSamples).toEqual([1, 2, 3])
  })

  it('serializes a null current as JSON null', () => {
    const series: TelemetrySeries = { speedHistory: [1], energyHistory: [10] }
    const json = telemetryToJson(series, null)
    const parsed = JSON.parse(json)
    expect(parsed.current).toBeNull()
    expect(parsed.speedHistory).toEqual([1])
  })
})
