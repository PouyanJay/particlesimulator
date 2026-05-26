import { describe, it, expect } from 'vitest'
import {
  telemetryAtLeast,
  telemetryAtMost,
  paramEquals,
  telemetryIncreasedFrom,
} from './checks'
import type { ChallengeContext } from './types'
import type { Telemetry } from '../types'

/** A minimal telemetry stub; spread overrides in per test. */
function telemetry(over: Partial<Telemetry> = {}): Telemetry {
  return { particleCount: 0, averageSpeed: 0, kineticEnergy: 0, ...over }
}

function ctx(over: Partial<ChallengeContext> = {}): ChallengeContext {
  return { telemetry: telemetry(), params: {}, ...over }
}

describe('telemetryAtLeast', () => {
  it('passes when the field meets or exceeds the threshold', () => {
    const check = telemetryAtLeast('temperature', 1.5)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 1.5 }) }))).toBe(true)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 2 }) }))).toBe(true)
  })

  it('fails below the threshold', () => {
    const check = telemetryAtLeast('temperature', 1.5)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 1.4 }) }))).toBe(false)
  })

  it('fails (does not throw) when the field is undefined', () => {
    const check = telemetryAtLeast('pressure', 0.1)
    expect(check.evaluate(ctx({ telemetry: telemetry() }))).toBe(false)
  })

  it('describes the criterion', () => {
    expect(telemetryAtLeast('averageSpeed', 1).describe).toMatch(/averageSpeed/)
  })
})

describe('telemetryAtMost', () => {
  it('passes when the field is at or below the threshold', () => {
    const check = telemetryAtMost('temperature', 2)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 2 }) }))).toBe(true)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 1 }) }))).toBe(true)
  })

  it('fails above the threshold', () => {
    const check = telemetryAtMost('temperature', 2)
    expect(check.evaluate(ctx({ telemetry: telemetry({ temperature: 2.1 }) }))).toBe(false)
  })

  it('fails (does not throw) when the field is undefined', () => {
    const check = telemetryAtMost('pressure', 1)
    expect(check.evaluate(ctx({ telemetry: telemetry() }))).toBe(false)
  })
})

describe('paramEquals', () => {
  it('passes when the param matches the expected value', () => {
    expect(paramEquals('holdTemperature', true).evaluate(ctx({ params: { holdTemperature: true } }))).toBe(true)
    expect(paramEquals('particleCount', 200).evaluate(ctx({ params: { particleCount: 200 } }))).toBe(true)
  })

  it('fails when the param differs or is absent', () => {
    expect(paramEquals('holdTemperature', true).evaluate(ctx({ params: { holdTemperature: false } }))).toBe(false)
    expect(paramEquals('holdTemperature', true).evaluate(ctx({ params: {} }))).toBe(false)
  })
})

describe('telemetryIncreasedFrom', () => {
  it('passes when the field exceeds the baseline (default factor 1)', () => {
    const check = telemetryIncreasedFrom('pressure')
    const c = ctx({
      telemetry: telemetry({ pressure: 0.5 }),
      baseline: telemetry({ pressure: 0.3 }),
    })
    expect(check.evaluate(c)).toBe(true)
  })

  it('respects a multiplicative factor', () => {
    const check = telemetryIncreasedFrom('pressure', 1.5)
    expect(
      check.evaluate(ctx({ telemetry: telemetry({ pressure: 0.46 }), baseline: telemetry({ pressure: 0.3 }) })),
    ).toBe(true) // 0.46 > 0.3 * 1.5 = 0.45
    expect(
      check.evaluate(ctx({ telemetry: telemetry({ pressure: 0.44 }), baseline: telemetry({ pressure: 0.3 }) })),
    ).toBe(false) // 0.44 < 0.45
  })

  it('fails (does not throw) when there is no baseline', () => {
    const check = telemetryIncreasedFrom('pressure')
    expect(check.evaluate(ctx({ telemetry: telemetry({ pressure: 99 }) }))).toBe(false)
  })

  it('fails when the current field is undefined', () => {
    const check = telemetryIncreasedFrom('pressure')
    expect(check.evaluate(ctx({ telemetry: telemetry(), baseline: telemetry({ pressure: 0.1 }) }))).toBe(false)
  })
})
