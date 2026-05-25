import { describe, it, expect } from 'vitest'
import { createSimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { defaultParamValues } from '../sim-core/paramSchema'

const gasParams = defaultParamValues(simRegistry.create('elastic-gas').paramSchema)
const scenario = (overrides = {}) => ({
  modeId: 'elastic-gas',
  seed: 1,
  params: { ...gasParams, ...overrides },
})

describe('createSimDriver', () => {
  it('returns no buffers before a scenario is loaded', () => {
    const driver = createSimDriver({ registry: simRegistry })
    expect(driver.getBuffers()).toBeNull()
  })

  it('loads a scenario and exposes correctly-sized buffers', () => {
    const driver = createSimDriver({ registry: simRegistry })
    driver.load(scenario({ particleCount: 40 }))
    expect(driver.getBuffers()?.count).toBe(40)
  })

  it('advances the simulation (positions change over time)', () => {
    const driver = createSimDriver({ registry: simRegistry })
    driver.load(scenario({ particleCount: 40, initialVelocity: 2 }))
    const before = Array.from(driver.getBuffers()!.positions)
    driver.advance(0.5)
    const after = Array.from(driver.getBuffers()!.positions)
    expect(after).not.toEqual(before)
  })

  it('emits an initial telemetry sample on load, then throttles by interval', () => {
    const driver = createSimDriver({ registry: simRegistry, telemetryIntervalSec: 0.5 })
    driver.load(scenario({ particleCount: 30 }))
    // Immediately after load, an initial sample is available.
    expect(driver.consumeTelemetry()?.particleCount).toBe(30)
    // Consumed once → null until the interval elapses.
    expect(driver.consumeTelemetry()).toBeNull()
    driver.advance(0.25)
    expect(driver.consumeTelemetry()).toBeNull() // not enough sim time yet
    driver.advance(0.3) // total 0.55s >= 0.5s interval
    expect(driver.consumeTelemetry()).not.toBeNull()
  })

  it('reloading a scenario re-initialises with the new parameters', () => {
    const driver = createSimDriver({ registry: simRegistry })
    driver.load(scenario({ particleCount: 20 }))
    expect(driver.getBuffers()?.count).toBe(20)
    driver.load(scenario({ particleCount: 75 }))
    expect(driver.getBuffers()?.count).toBe(75)
  })

  it('is deterministic: identical scenario + advance schedule yields identical buffers', () => {
    const a = createSimDriver({ registry: simRegistry })
    const b = createSimDriver({ registry: simRegistry })
    a.load(scenario({ particleCount: 32 }))
    b.load(scenario({ particleCount: 32 }))
    for (let i = 0; i < 30; i++) {
      a.advance(1 / 60)
      b.advance(1 / 60)
    }
    expect(Array.from(a.getBuffers()!.positions)).toEqual(Array.from(b.getBuffers()!.positions))
  })

  it('does not advance after dispose', () => {
    const driver = createSimDriver({ registry: simRegistry })
    driver.load(scenario({ particleCount: 20 }))
    driver.dispose()
    expect(driver.getBuffers()).toBeNull()
    expect(() => driver.advance(0.5)).not.toThrow()
  })
})
