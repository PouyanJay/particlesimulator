import { serializeScenario, deserializeScenario, type Scenario } from '../sim-core/scenario'

/**
 * Share links carry the whole scenario in the URL *hash* (client-side, longer payloads
 * allowed) under an `s=` prefix. We parse the hash manually rather than via URLSearchParams
 * because the lz-string alphabet contains '+', which URLSearchParams would decode to a space
 * and corrupt the payload. Pure — no `window` — so it's unit-testable.
 */
const HASH_PREFIX = 's='

/** `#s=<compressed>` for appending to a URL. */
export function encodeScenarioToHash(scenario: Scenario): string {
  return `#${HASH_PREFIX}${serializeScenario(scenario)}`
}

/** Decode a scenario from a location hash (`#s=…` or `s=…`); null if absent/invalid. */
export function decodeScenarioFromHash(hash: string): Scenario | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(HASH_PREFIX)) return null
  return deserializeScenario(raw.slice(HASH_PREFIX.length))
}

/** Build a full shareable URL from a base URL (its existing hash is replaced). */
export function buildShareUrl(scenario: Scenario, baseUrl: string): string {
  const base = baseUrl.split('#')[0]
  return `${base}${encodeScenarioToHash(scenario)}`
}

/**
 * Embed mode hides the app chrome (panels/docks) for clean iframes. Triggered by the
 * `/embed` path segment or an `embed` query flag, so it works under a GitHub Pages base path.
 */
export function isEmbedRoute(location: { pathname: string; search: string }): boolean {
  if (/(^|\/)embed\/?$/.test(location.pathname)) return true
  return new URLSearchParams(location.search).has('embed')
}
