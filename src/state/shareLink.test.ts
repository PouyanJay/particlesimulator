import { describe, it, expect } from 'vitest'
import { encodeScenarioToHash, decodeScenarioFromHash, buildShareUrl, isEmbedRoute } from './shareLink'
import type { Scenario } from '../sim-core/scenario'

const scenario: Scenario = {
  modeId: 'particle-life',
  seed: 7,
  params: { particleCount: 5000, types: 6 },
  view: '2d',
}

describe('share link', () => {
  it('round-trips a scenario through the URL hash', () => {
    const hash = encodeScenarioToHash(scenario)
    expect(hash.startsWith('#s=')).toBe(true)
    expect(decodeScenarioFromHash(hash)).toEqual(scenario)
  })

  it('decodes a hash with or without the leading #', () => {
    const hash = encodeScenarioToHash(scenario)
    expect(decodeScenarioFromHash(hash.slice(1))).toEqual(scenario)
  })

  it('survives a real URL round-trip including any + in the payload', () => {
    const url = buildShareUrl(scenario, 'https://example.com/lab/')
    const parsed = new URL(url)
    expect(decodeScenarioFromHash(parsed.hash)).toEqual(scenario)
  })

  it('returns null when the hash has no scenario', () => {
    expect(decodeScenarioFromHash('')).toBeNull()
    expect(decodeScenarioFromHash('#other=1')).toBeNull()
    expect(decodeScenarioFromHash('#s=garbage!!!')).toBeNull()
  })

  it('replaces any existing hash when building a share URL', () => {
    const url = buildShareUrl(scenario, 'https://example.com/lab/#s=old')
    expect(url.split('#')).toHaveLength(2)
    expect(decodeScenarioFromHash(new URL(url).hash)).toEqual(scenario)
  })

  it('detects embed mode from the /embed path or ?embed flag', () => {
    expect(isEmbedRoute({ pathname: '/embed', search: '' })).toBe(true)
    expect(isEmbedRoute({ pathname: '/lab/embed/', search: '' })).toBe(true)
    expect(isEmbedRoute({ pathname: '/', search: '?embed' })).toBe(true)
    expect(isEmbedRoute({ pathname: '/', search: '?embed=1' })).toBe(true)
    expect(isEmbedRoute({ pathname: '/', search: '' })).toBe(false)
    expect(isEmbedRoute({ pathname: '/embedded', search: '' })).toBe(false)
  })
})
