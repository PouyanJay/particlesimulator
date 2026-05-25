import { lennardJonesForce } from './lennardJonesForce'
import { createSpatialGrid, type SpatialGrid } from './spatialGrid'

/**
 * Grid-accelerated Lennard-Jones acceleration field (equal unit mass ⇒ a = F).
 *
 * For each atom i: a_i = Σ_{j≠i, r<rc} F_shift(r)·(−r̂_ij) summed over neighbours within the
 * cutoff, using the force-shifted LJ kernel (see `lennardJonesForce`). Pairs are evaluated
 * once with the i<j symmetry and contribute equal-and-opposite forces (total momentum is
 * conserved). The uniform grid (cell size = cutoff) narrows candidates to the same/adjacent
 * cell so the cost is ~O(N); the exact cutoff is re-checked per pair, so the result is
 * identical to brute-force O(N²) — verified in the tests.
 *
 * Returned as a stateful kernel that owns its grid and a single reusable neighbour callback,
 * so the per-step hot loop allocates nothing (the elasticGas-style scratch discipline).
 */
export interface LennardJonesField {
  /**
   * Write the LJ accelerations for `positions` into `out` (both xyz-interleaved, length
   * 3·count). Rebuilds the grid from the current positions each call.
   */
  computeAccelerations(positions: Readonly<Float64Array>, count: number, out: Float64Array): void
}

/**
 * Create a Lennard-Jones acceleration field with fixed interaction parameters. The grid's
 * cell size is the cutoff so every interacting pair lands in the same or an adjacent cell.
 *
 * @param epsilon LJ well depth ε
 * @param sigma   LJ length scale σ
 * @param cutoff  cutoff radius in absolute length units (e.g. 2.5·σ)
 * @param grid    optional pre-built grid (defaults to one sized to the cutoff)
 */
export function createLennardJonesField(
  epsilon: number,
  sigma: number,
  cutoff: number,
  grid: SpatialGrid = createSpatialGrid(cutoff),
): LennardJonesField {
  const cutoffSq = cutoff * cutoff

  // Scratch shared with the neighbour callback so it is allocated exactly once.
  let pos: Readonly<Float64Array> = new Float64Array(0)
  let acc: Float64Array = new Float64Array(0)
  let probeIndex = 0
  let xi = 0
  let yi = 0
  let zi = 0

  // Accumulate the LJ acceleration on `probeIndex` from one neighbour candidate; each
  // unordered pair is handled once (`other > probeIndex`), exact cutoff re-checked here.
  function onNeighbor(other: number): void {
    if (other <= probeIndex) return
    const oj = other * 3
    const dx = pos[oj] - xi
    const dy = pos[oj + 1] - yi
    const dz = pos[oj + 2] - zi
    const distSq = dx * dx + dy * dy + dz * dz
    if (distSq >= cutoffSq || distSq === 0) return
    const r = Math.sqrt(distSq)
    const fMag = lennardJonesForce(r, epsilon, sigma, cutoff)
    const inv = 1 / r
    const fx = fMag * dx * inv
    const fy = fMag * dy * inv
    const fz = fMag * dz * inv
    const oi = probeIndex * 3
    // Positive fMag = repulsive: push i along −r̂ and j along +r̂ (equal and opposite).
    acc[oi] -= fx
    acc[oi + 1] -= fy
    acc[oi + 2] -= fz
    acc[oj] += fx
    acc[oj + 1] += fy
    acc[oj + 2] += fz
  }

  return {
    computeAccelerations(positions, count, out) {
      pos = positions
      acc = out
      out.fill(0)
      grid.clear()
      for (let i = 0; i < count; i++) {
        grid.insert(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      }
      for (let i = 0; i < count; i++) {
        probeIndex = i
        xi = positions[i * 3]
        yi = positions[i * 3 + 1]
        zi = positions[i * 3 + 2]
        grid.forEachNeighbor(i, xi, yi, zi, onNeighbor)
      }
    },
  }
}
