import { describe, it, expect } from 'vitest'
import {
  SCENARIO_VERSION,
  serializeScenario,
  deserializeScenario,
  scenarioToJson,
  scenarioFromJson,
  type Scenario,
} from './scenario'

const base: Scenario = {
  modeId: 'elastic-gas',
  seed: 42,
  params: { particleCount: 200, gravity: 0, holdTemperature: false },
}

describe('scenario serialization', () => {
  it('round-trips a minimal scenario through the URL-safe encoding', () => {
    const encoded = serializeScenario(base)
    expect(typeof encoded).toBe('string')
    expect(deserializeScenario(encoded)).toEqual(base)
  })

  it('round-trips the full scenario including camera, substance, and view', () => {
    const full: Scenario = {
      ...base,
      substanceId: 'argon',
      view: '2d',
      camera: { position: [1, 2, 3], target: [0, 0, 0] },
    }
    expect(deserializeScenario(serializeScenario(full))).toEqual(full)
  })

  it('produces a hash-fragment-safe string (no #, whitespace, or % that would break a URL hash)', () => {
    const encoded = serializeScenario(base)
    expect(encoded).not.toMatch(/[#%\s]/)
  })

  it('compresses large param sets to a string far shorter than raw JSON', () => {
    const big: Scenario = {
      modeId: 'particle-life',
      seed: 7,
      params: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`p${i}`, i * 1.5])),
    }
    const encoded = serializeScenario(big)
    expect(encoded.length).toBeLessThan(JSON.stringify(big).length)
  })

  it('returns null for malformed encodings rather than throwing (URLs are untrusted)', () => {
    expect(deserializeScenario('')).toBeNull()
    expect(deserializeScenario('not-valid-lz')).toBeNull()
    expect(deserializeScenario('%%%')).toBeNull()
  })

  it('rejects a decoded payload missing required fields', () => {
    // Hand-craft an encoding of a structurally-wrong object.
    const bad = serializeScenario({ modeId: 'x', seed: 1, params: {} })
    expect(deserializeScenario(bad)).not.toBeNull() // sanity: that one is valid
    const wrong = serializeScenarioRaw({ v: SCENARIO_VERSION, seed: 1, params: {} })
    expect(deserializeScenario(wrong)).toBeNull()
  })

  it('rejects params containing non-finite numbers (NaN / Infinity) from untrusted input', () => {
    const nan = serializeScenarioRaw({ v: SCENARIO_VERSION, modeId: 'x', seed: 1, params: { a: Number.NaN } })
    const inf = serializeScenarioRaw({ v: SCENARIO_VERSION, modeId: 'x', seed: 1, params: { a: Infinity } })
    // JSON serializes NaN/Infinity to null, so also assert null params are rejected.
    expect(deserializeScenario(nan)).toBeNull()
    expect(deserializeScenario(inf)).toBeNull()
    expect(scenarioFromJson('{"v":1,"modeId":"x","seed":1,"params":{"a":null}}')).toBeNull()
  })

  it('rejects params containing non-primitive values', () => {
    const wrong = serializeScenarioRaw({
      v: SCENARIO_VERSION,
      modeId: 'x',
      seed: 1,
      params: { a: { nested: true } },
    })
    expect(deserializeScenario(wrong)).toBeNull()
  })

  it('rejects a future/unknown schema version', () => {
    const future = serializeScenarioRaw({ v: 999, modeId: 'x', seed: 1, params: {} })
    expect(deserializeScenario(future)).toBeNull()
  })

  it('round-trips through human-readable JSON (file export/import)', () => {
    const full: Scenario = { ...base, substanceId: 'argon', view: '2d', camera: { position: [1, 2, 3], target: [0, 0, 0] } }
    const json = scenarioToJson(full)
    expect(json).toContain('\n') // pretty-printed
    expect(scenarioFromJson(json)).toEqual(full)
  })

  it('scenarioFromJson rejects malformed or wrong-shaped JSON', () => {
    expect(scenarioFromJson('not json')).toBeNull()
    expect(scenarioFromJson('{"v":1,"seed":1,"params":{}}')).toBeNull() // missing modeId
    expect(scenarioFromJson('{"v":999,"modeId":"x","seed":1,"params":{}}')).toBeNull() // wrong version
  })

  it('embeds the current version in the encoded payload', () => {
    // The decoder must tolerate the version it itself emits.
    expect(deserializeScenario(serializeScenario(base))).toEqual(base)
    expect(SCENARIO_VERSION).toBeGreaterThanOrEqual(1)
  })
})

// Test helper: encode an arbitrary object with the same transport as serializeScenario,
// so we can craft malformed payloads to exercise the validator.
import { compressToEncodedURIComponent } from 'lz-string'
function serializeScenarioRaw(obj: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(obj))
}
