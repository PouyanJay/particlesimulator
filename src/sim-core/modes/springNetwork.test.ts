import { describe, it, expect } from 'vitest'
import { buildSpringNetwork, type SpringNetworkOptions } from './springNetwork'

const base: SpringNetworkOptions = {
  cols: 3,
  rows: 3,
  layers: 1,
  spacing: 1,
  shear: false,
  bend: false,
  pinTop: false,
}

/** Euclidean distance between two nodes in a flat xyz-interleaved buffer. */
function dist(positions: Float64Array, i: number, j: number): number {
  const a = i * 3
  const b = j * 3
  return Math.hypot(positions[a] - positions[b], positions[a + 1] - positions[b + 1], positions[a + 2] - positions[b + 2])
}

describe('buildSpringNetwork — topology builder', () => {
  it('places cols·rows·layers nodes with correctly sized buffers', () => {
    const net = buildSpringNetwork({ ...base, cols: 4, rows: 3, layers: 2 })
    expect(net.nodeCount).toBe(24)
    expect(net.positions.length).toBe(24 * 3)
    expect(net.pinned.length).toBe(24)
    expect(net.edges.length).toBe(net.restLengths.length * 2)
  })

  it('builds a rope (1×N) as a simple chain of N−1 structural springs', () => {
    const net = buildSpringNetwork({ ...base, cols: 5, rows: 1, layers: 1, spacing: 2 })
    expect(net.nodeCount).toBe(5)
    expect(net.restLengths.length).toBe(4)
    for (let e = 0; e < net.restLengths.length; e++) expect(net.restLengths[e]).toBeCloseTo(2, 12)
  })

  it('counts structural cloth springs: (C−1)·R horizontal + C·(R−1) vertical', () => {
    const net = buildSpringNetwork(base) // 3×3 → 2·3 + 3·2 = 12
    expect(net.restLengths.length).toBe(12)
  })

  it('adds shear (face-diagonal) springs at √2·spacing when enabled', () => {
    const net = buildSpringNetwork({ ...base, shear: true }) // +2·(C−1)·(R−1) = +8
    expect(net.restLengths.length).toBe(20)
    // The longest rest lengths are the diagonals.
    const maxRest = Math.max(...net.restLengths)
    expect(maxRest).toBeCloseTo(Math.SQRT2, 10)
  })

  it('adds bend (skip-one) springs at 2·spacing when enabled', () => {
    // 3×3 bend: horizontal (C−2)·R = 1·3 = 3, vertical C·(R−2) = 3·1 = 3 → +6.
    const net = buildSpringNetwork({ ...base, bend: true })
    expect(net.restLengths.length).toBe(18)
    expect(Math.max(...net.restLengths)).toBeCloseTo(2, 10)
  })

  it('sets every rest length to the actual initial separation of its endpoints', () => {
    const net = buildSpringNetwork({ ...base, shear: true, bend: true, spacing: 1.5 })
    for (let e = 0; e < net.restLengths.length; e++) {
      const i = net.edges[e * 2]
      const j = net.edges[e * 2 + 1]
      expect(net.restLengths[e]).toBeCloseTo(dist(net.positions, i, j), 10)
    }
  })

  it('centres the grid on the origin', () => {
    const net = buildSpringNetwork({ ...base, cols: 4, rows: 2, layers: 3, spacing: 2 })
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < net.nodeCount; i++) {
      sx += net.positions[i * 3]
      sy += net.positions[i * 3 + 1]
      sz += net.positions[i * 3 + 2]
    }
    expect(sx / net.nodeCount).toBeCloseTo(0, 10)
    expect(sy / net.nodeCount).toBeCloseTo(0, 10)
    expect(sz / net.nodeCount).toBeCloseTo(0, 10)
  })

  it('pins exactly the top row (max Y) when pinTop is set', () => {
    const net = buildSpringNetwork({ ...base, cols: 3, rows: 3, layers: 1, pinTop: true })
    const pinnedCount = net.pinned.reduce((a, b) => a + b, 0)
    expect(pinnedCount).toBe(3) // cols·layers along the top row
    // The pinned nodes are the ones at the maximum y.
    let maxY = -Infinity
    for (let i = 0; i < net.nodeCount; i++) maxY = Math.max(maxY, net.positions[i * 3 + 1])
    for (let i = 0; i < net.nodeCount; i++) {
      const atTop = Math.abs(net.positions[i * 3 + 1] - maxY) < 1e-9
      expect(net.pinned[i]).toBe(atTop ? 1 : 0)
    }
  })

  it('pins nothing by default', () => {
    const net = buildSpringNetwork(base)
    expect(net.pinned.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('produces no self-edges and no duplicate edges', () => {
    const net = buildSpringNetwork({ ...base, cols: 3, rows: 3, layers: 2, shear: true, bend: true })
    const seen = new Set<string>()
    for (let e = 0; e < net.restLengths.length; e++) {
      const i = net.edges[e * 2]
      const j = net.edges[e * 2 + 1]
      expect(i).not.toBe(j)
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('is deterministic: identical options produce identical buffers', () => {
    const opts: SpringNetworkOptions = { ...base, cols: 4, rows: 5, layers: 2, shear: true, bend: true, pinTop: true }
    const a = buildSpringNetwork(opts)
    const b = buildSpringNetwork(opts)
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions))
    expect(Array.from(a.edges)).toEqual(Array.from(b.edges))
    expect(Array.from(a.restLengths)).toEqual(Array.from(b.restLengths))
    expect(Array.from(a.pinned)).toEqual(Array.from(b.pinned))
  })
})
