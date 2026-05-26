import { describe, it, expect } from 'vitest'
import { createSpringMassMode, springMassSchema } from './springMass'
import type { ParamValues } from '../types'

type Params = ParamValues<typeof springMassSchema>

/** Build a params object from the schema defaults, overriding the given keys. */
function params(overrides: Partial<Params> = {}): Params {
  const base = Object.fromEntries(
    Object.entries(springMassSchema).map(([k, def]) => [k, def.default]),
  ) as Params
  return { ...base, ...overrides }
}

function step(mode: ReturnType<typeof createSpringMassMode>, frames: number, dt = 1 / 90): void {
  for (let f = 0; f < frames; f++) mode.step(dt)
}

function meanY(positions: Float32Array, count: number): number {
  let sy = 0
  for (let i = 0; i < count; i++) sy += positions[i * 3 + 1]
  return sy / count
}

describe('spring-mass mode', () => {
  it('exposes a node per grid point and a spring edge list in its buffers', () => {
    const mode = createSpringMassMode()
    mode.init({ seed: 1, params: params({ cols: 3, rows: 3, layers: 1, shear: false, bend: false }) })
    const b = mode.getBuffers()
    expect(b.count).toBe(9)
    expect(b.edges).toBeDefined()
    expect(b.edges!.length).toBe(2 * 12) // (3−1)·3 + 3·(3−1) = 12 structural springs
    expect(b.radius).toBeGreaterThan(0)
    expect(b.velocities).toBeDefined()
  })

  it('stays in equilibrium at the rest configuration with no gravity or damping', () => {
    const mode = createSpringMassMode()
    mode.init({
      seed: 1,
      params: params({ cols: 2, rows: 1, layers: 1, gravity: 0, damping: 0, pinTop: false, shear: false, bend: false }),
    })
    const before = Float32Array.from(mode.getBuffers().positions)
    step(mode, 300)
    const after = mode.getBuffers().positions
    for (let i = 0; i < after.length; i++) expect(after[i]).toBeCloseTo(before[i], 6)
    expect(mode.getTelemetry().kineticEnergy).toBeCloseTo(0, 6)
  })

  it('holds pinned nodes exactly fixed even under strong gravity', () => {
    const mode = createSpringMassMode()
    mode.init({ seed: 1, params: params({ cols: 4, rows: 4, layers: 1, pinTop: true, gravity: 12 }) })
    const b0 = mode.getBuffers()
    // Record positions of the pinned top row (max Y at init).
    let maxY = -Infinity
    for (let i = 0; i < b0.count; i++) maxY = Math.max(maxY, b0.positions[i * 3 + 1])
    const pinnedIdx: number[] = []
    for (let i = 0; i < b0.count; i++) if (Math.abs(b0.positions[i * 3 + 1] - maxY) < 1e-6) pinnedIdx.push(i)
    const pinnedPos = pinnedIdx.map((i) => [b0.positions[i * 3], b0.positions[i * 3 + 1], b0.positions[i * 3 + 2]])

    step(mode, 400)
    const after = mode.getBuffers().positions
    pinnedIdx.forEach((i, n) => {
      expect(after[i * 3]).toBeCloseTo(pinnedPos[n][0], 10)
      expect(after[i * 3 + 1]).toBeCloseTo(pinnedPos[n][1], 10)
      expect(after[i * 3 + 2]).toBeCloseTo(pinnedPos[n][2], 10)
    })
  })

  it('falls under gravity when nothing is pinned (centre of mass drops)', () => {
    const mode = createSpringMassMode()
    mode.init({ seed: 1, params: params({ cols: 3, rows: 3, layers: 1, pinTop: false, gravity: 6, damping: 0.2 }) })
    const y0 = meanY(mode.getBuffers().positions, mode.getBuffers().count)
    step(mode, 60)
    const y1 = meanY(mode.getBuffers().positions, mode.getBuffers().count)
    expect(y1).toBeLessThan(y0)
  })

  it('damping removes energy: a hanging cloth ends with lower kinetic energy than the undamped one', () => {
    const common = { cols: 5, rows: 5, layers: 1, pinTop: true, gravity: 6 } as const
    const damped = createSpringMassMode()
    damped.init({ seed: 1, params: params({ ...common, damping: 1.5 }) })
    const undamped = createSpringMassMode()
    undamped.init({ seed: 1, params: params({ ...common, damping: 0 }) })
    step(damped, 800)
    step(undamped, 800)
    expect(damped.getTelemetry().kineticEnergy).toBeLessThan(undamped.getTelemetry().kineticEnergy)
  })

  it('stays finite and inside the box over a long run at default parameters (stability)', () => {
    const mode = createSpringMassMode()
    mode.init({ seed: 1, params: params() })
    step(mode, 900)
    const b = mode.getBuffers()
    const half = (springMassSchema.containerSize.default as number) / 2
    for (let i = 0; i < b.positions.length; i++) {
      expect(Number.isFinite(b.positions[i])).toBe(true)
      expect(Math.abs(b.positions[i])).toBeLessThanOrEqual(half + 1e-6)
    }
  })

  it('stays stable at the worst case: a 3-D lattice at max stiffness with shear and bend springs', () => {
    // The stiffest normal mode (densely-coordinated interior nodes, max k, shear + bend) is the
    // genuine test of the SPRING_TIMESTEP substep margin — regression-guards it against schema
    // changes. Must stay finite and contained over a long run.
    const mode = createSpringMassMode()
    mode.init({
      seed: 1,
      params: params({ cols: 6, rows: 6, layers: 6, stiffness: 400, shear: true, bend: true, pinTop: true, gravity: 12 }),
    })
    step(mode, 900)
    const b = mode.getBuffers()
    const half = (springMassSchema.containerSize.default as number) / 2
    for (let i = 0; i < b.positions.length; i++) {
      expect(Number.isFinite(b.positions[i])).toBe(true)
      expect(Math.abs(b.positions[i])).toBeLessThanOrEqual(half + 1e-6)
    }
  })

  it('is deterministic: identical seed and params produce identical trajectories', () => {
    const a = createSpringMassMode()
    const b = createSpringMassMode()
    const p = params({ cols: 4, rows: 4, layers: 1, gravity: 6, damping: 0.5 })
    a.init({ seed: 7, params: p })
    b.init({ seed: 7, params: p })
    step(a, 200)
    step(b, 200)
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('flags the run inelastic under gravity or damping, conservative otherwise', () => {
    const driven = createSpringMassMode()
    driven.init({ seed: 1, params: params({ gravity: 6, damping: 1 }) })
    expect(driven.getTelemetry().inelastic).toBe(true)

    const conservative = createSpringMassMode()
    conservative.init({
      seed: 1,
      params: params({ gravity: 0, damping: 0, restitution: 1, pinTop: false }),
    })
    expect(conservative.getTelemetry().inelastic).toBe(false)
  })

  it('reports a sane telemetry summary', () => {
    const mode = createSpringMassMode()
    mode.init({ seed: 1, params: params({ cols: 3, rows: 3, layers: 1 }) })
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(9)
    expect(t.kineticEnergy).toBeGreaterThanOrEqual(0)
    expect(t.averageSpeed).toBeGreaterThanOrEqual(0)
  })

  it('registers with the spring-mass contract metadata', () => {
    const mode = createSpringMassMode()
    expect(mode.id).toBe('spring-mass')
    expect(mode.backend).toBe('cpu')
    expect(typeof mode.label).toBe('string')
  })
})
