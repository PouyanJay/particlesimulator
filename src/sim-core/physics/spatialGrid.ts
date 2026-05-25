/**
 * Uniform spatial hash grid for fixed-radius neighbour search — the broadphase that
 * turns pairwise collision detection from O(N²) into ~O(N) for roughly uniform density.
 *
 * Set `cellSize` to the interaction radius (e.g. the contact distance 2·r): any two
 * points within `cellSize` of each other necessarily fall in the same or an adjacent
 * cell, so scanning the 3×3×3 block around a query finds every true neighbour. Callers
 * still re-check the exact distance — cell hashing only narrows the candidates.
 *
 * Built CPU-first here; the same scheme ports to a GPU counting-sort grid in Phase 2.
 */
export interface SpatialGrid {
  clear(): void
  insert(index: number, x: number, y: number, z: number): void
  /**
   * Invoke `cb(other)` for every inserted point in the same or an adjacent cell as
   * `(x, y, z)`, excluding `self`. Candidates may be slightly farther than `cellSize`;
   * the caller filters by exact distance.
   */
  forEachNeighbor(self: number, x: number, y: number, z: number, cb: (other: number) => void): void
}

// Pack signed cell coordinates into one safe-integer key. OFFSET keeps coordinates
// non-negative; STRIDE must exceed 2·OFFSET. Valid for |cell index| < OFFSET, which
// covers any realistic container size / cell size here.
const OFFSET = 1 << 12 // 4096
const STRIDE = 1 << 13 // 8192

function cellKey(ix: number, iy: number, iz: number): number {
  return ((ix + OFFSET) * STRIDE + (iy + OFFSET)) * STRIDE + (iz + OFFSET)
}

export function createSpatialGrid(cellSize: number): SpatialGrid {
  const cells = new Map<number, number[]>()
  const inv = 1 / cellSize

  return {
    clear() {
      cells.clear()
    },

    insert(index, x, y, z) {
      const key = cellKey(Math.floor(x * inv), Math.floor(y * inv), Math.floor(z * inv))
      const bucket = cells.get(key)
      if (bucket) bucket.push(index)
      else cells.set(key, [index])
    },

    forEachNeighbor(self, x, y, z, cb) {
      const cx = Math.floor(x * inv)
      const cy = Math.floor(y * inv)
      const cz = Math.floor(z * inv)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = cells.get(cellKey(cx + dx, cy + dy, cz + dz))
            if (!bucket) continue
            for (let k = 0; k < bucket.length; k++) {
              const other = bucket[k]
              if (other !== self) cb(other)
            }
          }
        }
      }
    },
  }
}
