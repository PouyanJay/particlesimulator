import { describe, it, expect } from 'vitest'
import { createClothXpbdMode, clothXpbdSchema } from './clothXpbd'
import type { ParamValues } from '../types'

type Params = ParamValues<typeof clothXpbdSchema>

function params(overrides: Partial<Params> = {}): Params {
  const base = Object.fromEntries(
    Object.entries(clothXpbdSchema).map(([k, def]) => [k, def.default]),
  ) as Params
  return { ...base, ...overrides }
}

function step(mode: ReturnType<typeof createClothXpbdMode>, frames: number, dt = 1 / 90): void {
  for (let f = 0; f < frames; f++) mode.step(dt)
}

function meanY(positions: Float32Array, count: number): number {
  let sy = 0
  for (let i = 0; i < count; i++) sy += positions[i * 3 + 1]
  return sy / count
}

/** Mean edge length over the network — a proxy for how stretched the cloth is. */
function meanEdgeLength(positions: Float32Array, edges: Uint32Array): number {
  let sum = 0
  const e = edges.length >> 1
  for (let k = 0; k < e; k++) {
    const a = edges[k * 2] * 3
    const b = edges[k * 2 + 1] * 3
    sum += Math.hypot(positions[a] - positions[b], positions[a + 1] - positions[b + 1], positions[a + 2] - positions[b + 2])
  }
  return sum / e
}

describe('XPBD cloth / soft-body mode', () => {
  it('exposes a node per grid point and the constraint edge list in its buffers', () => {
    const mode = createClothXpbdMode()
    mode.init({ seed: 1, params: params({ cols: 4, rows: 4, layers: 1, shear: false, bend: false }) })
    const b = mode.getBuffers()
    expect(b.count).toBe(16)
    expect(b.edges).toBeDefined()
    expect(b.edges!.length).toBe(2 * ((4 - 1) * 4 + 4 * (4 - 1))) // structural cloth springs
    expect(b.radius).toBeGreaterThan(0)
    expect(b.velocities).toBeDefined()
  })

  it('drapes under gravity: the free nodes fall below their start while the pinned top holds', () => {
    const mode = createClothXpbdMode()
    mode.init({ seed: 1, params: params({ cols: 6, rows: 6, layers: 1, pinTop: true, gravity: 9 }) })
    const y0 = meanY(mode.getBuffers().positions, mode.getBuffers().count)
    step(mode, 120)
    expect(meanY(mode.getBuffers().positions, mode.getBuffers().count)).toBeLessThan(y0)
  })

  it('holds pinned nodes exactly fixed under strong gravity', () => {
    const mode = createClothXpbdMode()
    mode.init({ seed: 1, params: params({ cols: 5, rows: 5, layers: 1, pinTop: true, gravity: 15 }) })
    const b0 = mode.getBuffers()
    let maxY = -Infinity
    for (let i = 0; i < b0.count; i++) maxY = Math.max(maxY, b0.positions[i * 3 + 1])
    const pinned: number[] = []
    for (let i = 0; i < b0.count; i++) if (Math.abs(b0.positions[i * 3 + 1] - maxY) < 1e-6) pinned.push(i)
    const fixed = pinned.map((i) => [b0.positions[i * 3], b0.positions[i * 3 + 1], b0.positions[i * 3 + 2]])

    step(mode, 300)
    const after = mode.getBuffers().positions
    pinned.forEach((i, n) => {
      expect(after[i * 3]).toBeCloseTo(fixed[n][0], 10)
      expect(after[i * 3 + 1]).toBeCloseTo(fixed[n][1], 10)
      expect(after[i * 3 + 2]).toBeCloseTo(fixed[n][2], 10)
    })
  })

  it('is unconditionally stable: rigid constraints, huge gravity, a single iteration stay finite and contained', () => {
    // XPBD's headline property — a force-based spring-mass system at these settings (rigid,
    // big gravity, no substep headroom) would explode; position projection cannot.
    const mode = createClothXpbdMode()
    mode.init({
      seed: 1,
      params: params({ cols: 8, rows: 8, layers: 1, stiffness: 1, iterations: 1, gravity: 20, pinTop: true }),
    })
    step(mode, 1200)
    const b = mode.getBuffers()
    const half = (clothXpbdSchema.containerSize.default as number) / 2
    for (let i = 0; i < b.positions.length; i++) {
      expect(Number.isFinite(b.positions[i])).toBe(true)
      expect(Math.abs(b.positions[i])).toBeLessThanOrEqual(half + 1e-6)
    }
  })

  it('stiffens with more solver iterations: the cloth stretches less', () => {
    const common = { cols: 6, rows: 6, layers: 1, pinTop: true, gravity: 12, stiffness: 1 } as const
    const soft = createClothXpbdMode()
    soft.init({ seed: 1, params: params({ ...common, iterations: 1 }) })
    const stiff = createClothXpbdMode()
    stiff.init({ seed: 1, params: params({ ...common, iterations: 15 }) })
    step(soft, 200)
    step(stiff, 200)
    const softLen = meanEdgeLength(soft.getBuffers().positions, soft.getBuffers().edges!)
    const stiffLen = meanEdgeLength(stiff.getBuffers().positions, stiff.getBuffers().edges!)
    expect(stiffLen).toBeLessThan(softLen)
  })

  it('is deterministic: identical seed and params produce identical trajectories', () => {
    const a = createClothXpbdMode()
    const b = createClothXpbdMode()
    const p = params({ cols: 5, rows: 5, layers: 1, gravity: 9 })
    a.init({ seed: 3, params: p })
    b.init({ seed: 3, params: p })
    step(a, 200)
    step(b, 200)
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('reports a sane telemetry summary and flags gravity-driven runs inelastic', () => {
    const mode = createClothXpbdMode()
    mode.init({ seed: 1, params: params({ cols: 4, rows: 4, layers: 1, gravity: 9 }) })
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(16)
    expect(t.kineticEnergy).toBeGreaterThanOrEqual(0)
    expect(t.averageSpeed).toBeGreaterThanOrEqual(0)
    expect(t.inelastic).toBe(true)
  })

  it('registers with the XPBD-cloth contract metadata', () => {
    const mode = createClothXpbdMode()
    expect(mode.id).toBe('xpbd-cloth')
    expect(mode.backend).toBe('cpu')
    expect(typeof mode.label).toBe('string')
  })
})
