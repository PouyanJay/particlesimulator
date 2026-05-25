import { describe, it, expect } from 'vitest'
import { createSpatialGrid } from './spatialGrid'
import { createRng } from '../rng'

type Pt = [number, number, number]

function distance(a: Pt, b: Pt): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function brutePairs(pts: Pt[], maxDist: number): Set<string> {
  const pairs = new Set<string>()
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (distance(pts[i], pts[j]) < maxDist) pairs.add(`${i}-${j}`)
    }
  }
  return pairs
}

function randomPoints(n: number, seed: number): Pt[] {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1] as Pt)
}

describe('createSpatialGrid', () => {
  const cellSize = 0.2

  it('finds every neighbor pair within the cell size (completeness vs brute force)', () => {
    const pts = randomPoints(300, 7)
    const grid = createSpatialGrid(cellSize)
    pts.forEach((p, i) => grid.insert(i, p[0], p[1], p[2]))

    const found = new Set<string>()
    pts.forEach((p, i) => {
      grid.forEachNeighbor(i, p[0], p[1], p[2], (j) => {
        if (distance(pts[i], pts[j]) < cellSize) {
          found.add(i < j ? `${i}-${j}` : `${j}-${i}`)
        }
      })
    })
    expect(found).toEqual(brutePairs(pts, cellSize))
  })

  it('never yields the queried index itself', () => {
    const pts = randomPoints(50, 3)
    const grid = createSpatialGrid(cellSize)
    pts.forEach((p, i) => grid.insert(i, p[0], p[1], p[2]))
    pts.forEach((p, i) => {
      grid.forEachNeighbor(i, p[0], p[1], p[2], (j) => expect(j).not.toBe(i))
    })
  })

  it('handles negative coordinates', () => {
    const grid = createSpatialGrid(1)
    grid.insert(0, -5.5, -5.5, -5.5)
    grid.insert(1, -5.4, -5.4, -5.4) // same cell
    const neighbors: number[] = []
    grid.forEachNeighbor(0, -5.5, -5.5, -5.5, (j) => neighbors.push(j))
    expect(neighbors).toContain(1)
  })

  it('clear() empties the grid', () => {
    const grid = createSpatialGrid(cellSize)
    grid.insert(0, 0, 0, 0)
    grid.insert(1, 0.05, 0, 0)
    grid.clear()
    const neighbors: number[] = []
    grid.forEachNeighbor(0, 0, 0, 0, (j) => neighbors.push(j))
    expect(neighbors).toEqual([])
  })
})
