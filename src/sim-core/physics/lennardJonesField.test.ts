import { describe, it, expect } from 'vitest'
import { createLennardJonesField } from './lennardJonesField'
import { lennardJonesForce } from './lennardJonesForce'
import { createRng } from '../rng'

const eps = 1.2
const sigma = 1.0
const cutoff = 2.5 * sigma

/** Brute-force O(N²) reference LJ acceleration field (equal unit mass ⇒ a = F). */
function bruteForce(positions: Float64Array, count: number): Float64Array {
  const out = new Float64Array(count * 3)
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = positions[j * 3] - positions[i * 3]
      const dy = positions[j * 3 + 1] - positions[i * 3 + 1]
      const dz = positions[j * 3 + 2] - positions[i * 3 + 2]
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (r >= cutoff || r === 0) continue
      const fMag = lennardJonesForce(r, eps, sigma, cutoff)
      const inv = 1 / r
      const fx = fMag * dx * inv
      const fy = fMag * dy * inv
      const fz = fMag * dz * inv
      out[i * 3] -= fx
      out[i * 3 + 1] -= fy
      out[i * 3 + 2] -= fz
      out[j * 3] += fx
      out[j * 3 + 1] += fy
      out[j * 3 + 2] += fz
    }
  }
  return out
}

/** Random atoms spread thinly enough that some, but not all, pairs are within the cutoff. */
function randomAtoms(n: number, seed: number, span: number): Float64Array {
  const rng = createRng(seed)
  const out = new Float64Array(n * 3)
  for (let i = 0; i < n * 3; i++) out[i] = (rng() * 2 - 1) * span
  return out
}

/** A perSide³ simple-cubic lattice (spacing in σ) with small jitter — non-overlapping. */
function jitteredLattice(perSide: number, spacingSigma: number, jitter: number, seed: number): Float64Array {
  const rng = createRng(seed)
  const out = new Float64Array(perSide * perSide * perSide * 3)
  let k = 0
  for (let ix = 0; ix < perSide; ix++) {
    for (let iy = 0; iy < perSide; iy++) {
      for (let iz = 0; iz < perSide; iz++) {
        out[k++] = ix * spacingSigma + (rng() * 2 - 1) * jitter
        out[k++] = iy * spacingSigma + (rng() * 2 - 1) * jitter
        out[k++] = iz * spacingSigma + (rng() * 2 - 1) * jitter
      }
    }
  }
  return out
}

describe('createLennardJonesField — grid equals brute force', () => {
  it('matches brute-force O(N²) accelerations on small N within float tolerance', () => {
    const count = 80
    const positions = randomAtoms(count, 11, 4) // span 4 ⇒ mixed in/out of cutoff
    const field = createLennardJonesField(eps, sigma, cutoff)
    const grid = new Float64Array(count * 3)
    field.computeAccelerations(positions, count, grid)
    const brute = bruteForce(positions, count)
    let maxErr = 0
    let maxForce = 0
    for (let i = 0; i < count * 3; i++) {
      maxErr = Math.max(maxErr, Math.abs(grid[i] - brute[i]))
      maxForce = Math.max(maxForce, Math.abs(brute[i]))
    }
    // Same pair set, same kernel ⇒ identical up to Float64 summation order (the grid groups
    // pairs by cell, brute by i<j). The only difference is rounding, so the tolerance scales
    // with the largest force present (random configs can put a pair near the steep core).
    expect(maxErr).toBeLessThan(1e-12 * Math.max(1, maxForce))
  })

  it('agrees with brute force when every pair is inside the cutoff (close, non-overlapping)', () => {
    // A jittered small lattice: all pairs interact (span < cutoff) but no pair sits inside
    // the steep repulsive core, so forces are moderate and an absolute float tolerance is
    // meaningful (a random tight cluster would put atoms at r→0 with ~1e23 forces).
    const positions = jitteredLattice(3, sigma, 0.1, 5) // 27 atoms, spacing ≈ σ
    const count = positions.length / 3
    const field = createLennardJonesField(eps, sigma, cutoff)
    const grid = new Float64Array(count * 3)
    field.computeAccelerations(positions, count, grid)
    const brute = bruteForce(positions, count)
    let maxErr = 0
    let maxForce = 0
    for (let i = 0; i < count * 3; i++) {
      maxErr = Math.max(maxErr, Math.abs(grid[i] - brute[i]))
      maxForce = Math.max(maxForce, Math.abs(brute[i]))
    }
    expect(maxForce).toBeGreaterThan(0) // sanity: atoms actually interact
    expect(maxErr).toBeLessThan(1e-9)
  })

  it('produces a momentum-conserving (net-zero) force field', () => {
    const count = 60
    const positions = randomAtoms(count, 99, 2)
    const field = createLennardJonesField(eps, sigma, cutoff)
    const out = new Float64Array(count * 3)
    field.computeAccelerations(positions, count, out)
    let sx = 0
    let sy = 0
    let sz = 0
    let absMax = 0
    for (let i = 0; i < count; i++) {
      sx += out[i * 3]
      sy += out[i * 3 + 1]
      sz += out[i * 3 + 2]
      for (let a = 0; a < 3; a++) absMax = Math.max(absMax, Math.abs(out[i * 3 + a]))
    }
    // Every pair adds equal-and-opposite contributions, so ΣF is zero up to the unavoidable
    // Float64 summation rounding — relative to the largest individual force, not absolute.
    const rel = 1e-10 * Math.max(1, absMax) * count
    expect(Math.abs(sx)).toBeLessThan(rel)
    expect(Math.abs(sy)).toBeLessThan(rel)
    expect(Math.abs(sz)).toBeLessThan(rel)
  })
})
