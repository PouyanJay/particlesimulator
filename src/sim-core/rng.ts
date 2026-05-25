/**
 * Seeded pseudo-random number generator for the simulation core.
 *
 * Determinism is a hard requirement: a scenario is defined by `(mode, params, seed)`
 * and must replay identically (CPU path). We use mulberry32 — a fast, well-distributed
 * 32-bit generator — so every consumer draws from a reproducible stream.
 */

/** A pure random source returning a float in the half-open interval [0, 1). */
export type Rng = () => number

/**
 * Create a deterministic RNG from an integer seed.
 *
 * Non-integer seeds are floored to a 32-bit unsigned integer (e.g. 3.7 → 3), and
 * adjacent integer seeds are not guaranteed to be well-separated on the very first
 * draw — fine for scenario seeding, but don't rely on `seed` and `seed+1` diverging
 * on output #1.
 */
export function createRng(seed: number): Rng {
  // Coerce to a 32-bit unsigned integer so any number/float seed is usable.
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Draw a float uniformly in [min, max). */
export function randomInRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}
