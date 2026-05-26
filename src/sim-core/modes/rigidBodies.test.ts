import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createRigidBodiesMode, rigidBodiesSchema } from './rigidBodies'
import { ensureRapierReady } from '../physics/rapierEngine'
import { ShapeType, type ParamValues } from '../types'

type Params = ParamValues<typeof rigidBodiesSchema>

function params(overrides: Partial<Params> = {}): Params {
  const base = Object.fromEntries(
    Object.entries(rigidBodiesSchema).map(([k, def]) => [k, def.default]),
  ) as Params
  return { ...base, ...overrides }
}

function step(mode: ReturnType<typeof createRigidBodiesMode>, frames: number, dt = 1 / 90): void {
  for (let f = 0; f < frames; f++) mode.step(dt)
}

function meanY(b: { positions: Float32Array; count: number }): number {
  let s = 0
  for (let i = 0; i < b.count; i++) s += b.positions[i * 3 + 1]
  return s / b.count
}

// Rapier must be initialised before any rigid-body mode can be constructed.
beforeAll(async () => {
  await ensureRapierReady()
}, 20000)

// Free each world after a test so the WASM heap doesn't accumulate across the suite.
let active: ReturnType<typeof createRigidBodiesMode>[] = []
function make(): ReturnType<typeof createRigidBodiesMode> {
  const m = createRigidBodiesMode()
  active.push(m)
  return m
}
afterEach(() => {
  active.forEach((m) => m.dispose())
  active = []
})

describe('rigid-body sandbox mode (Rapier)', () => {
  it('creates the requested number of dynamic bodies with oriented, shaped buffers', () => {
    const mode = make()
    mode.init({ seed: 1, params: params({ bodyCount: 20 }) })
    const b = mode.getBuffers()
    expect(b.count).toBe(20)
    expect(b.positions.length).toBe(60)
    expect(b.orientations!.length).toBe(80) // xyzw per body
    expect(b.shapeTypes!.length).toBe(20)
    expect(b.halfExtents!.length).toBe(60)
    expect(b.velocities!.length).toBe(60)
    expect(b.radius).toBeGreaterThan(0)
    // Orientations are unit quaternions.
    for (let i = 0; i < b.count; i++) {
      const o = i * 4
      const n = Math.hypot(b.orientations![o], b.orientations![o + 1], b.orientations![o + 2], b.orientations![o + 3])
      expect(n).toBeCloseTo(1, 5)
    }
  })

  it('drops the bodies under gravity (centre of mass falls)', () => {
    const mode = make()
    mode.init({ seed: 2, params: params({ bodyCount: 24, gravity: 9.81 }) })
    const y0 = meanY(mode.getBuffers())
    step(mode, 45)
    expect(meanY(mode.getBuffers())).toBeLessThan(y0)
  })

  it('settles the bodies on the floor without tunnelling through it', () => {
    const size = 16
    const mode = make()
    mode.init({ seed: 3, params: params({ bodyCount: 30, containerSize: size, gravity: 12 }) })
    step(mode, 400)
    const b = mode.getBuffers()
    const floorY = -size / 2
    for (let i = 0; i < b.count; i++) {
      expect(Number.isFinite(b.positions[i * 3 + 1])).toBe(true)
      expect(b.positions[i * 3 + 1]).toBeGreaterThan(floorY - 0.5) // didn't fall through
    }
  })

  it('keeps every body inside the container walls', () => {
    const size = 14
    const mode = make()
    mode.init({ seed: 4, params: params({ bodyCount: 40, containerSize: size, gravity: 12 }) })
    step(mode, 300)
    const b = mode.getBuffers()
    const half = size / 2
    for (let i = 0; i < b.count; i++) {
      expect(Math.abs(b.positions[i * 3])).toBeLessThan(half + 0.6)
      expect(Math.abs(b.positions[i * 3 + 2])).toBeLessThan(half + 0.6)
    }
  })

  it('contains a dense pile inside the closed box without escaping or exploding', () => {
    const size = 10
    const mode = make()
    mode.init({ seed: 11, params: params({ bodyCount: 120, bodySize: 1, containerSize: size, gravity: 15 }) })
    step(mode, 400)
    const b = mode.getBuffers()
    const half = size / 2
    expect(b.count).toBeGreaterThan(0)
    for (let i = 0; i < b.count; i++) {
      for (let a = 0; a < 3; a++) {
        const v = b.positions[i * 3 + a]
        expect(Number.isFinite(v)).toBe(true)
        expect(Math.abs(v)).toBeLessThan(half + 0.6) // ceiling + walls keep every axis bounded
      }
    }
  })

  it('does not explode even when bodies barely fit the box (no initial overlap)', () => {
    // A pathological request (bodies nearly as large as the box, far more than fit): the placement
    // never overlaps bodies, so Rapier has no huge separating impulse to launch them out. The count
    // is clamped to what fits, and everything stays finite and contained.
    const size = 6
    const mode = make()
    mode.init({ seed: 12, params: params({ bodyCount: 30, bodySize: 3, containerSize: size, gravity: 30 }) })
    step(mode, 200)
    const b = mode.getBuffers()
    const half = size / 2
    expect(b.count).toBeGreaterThan(0)
    expect(b.count).toBeLessThanOrEqual(30)
    for (let i = 0; i < b.positions.length; i++) {
      expect(Number.isFinite(b.positions[i])).toBe(true)
      expect(Math.abs(b.positions[i])).toBeLessThan(half + 1)
    }
  })

  it('settles to rest under damping/friction (kinetic energy decays to near zero)', () => {
    const mode = make()
    mode.init({ seed: 13, params: params({ bodyCount: 30, containerSize: 14, gravity: 12, restitution: 0.2 }) })
    step(mode, 700) // give the pile time to settle on the floor
    expect(mode.getTelemetry().averageSpeed).toBeLessThan(0.5) // essentially at rest
  })

  it('mixes shapes according to the box fraction', () => {
    const allSpheres = make()
    allSpheres.init({ seed: 5, params: params({ bodyCount: 16, boxFraction: 0 }) })
    expect(Array.from(allSpheres.getBuffers().shapeTypes!).every((s) => s === ShapeType.Sphere)).toBe(true)

    const allBoxes = make()
    allBoxes.init({ seed: 5, params: params({ bodyCount: 16, boxFraction: 1 }) })
    expect(Array.from(allBoxes.getBuffers().shapeTypes!).every((s) => s === ShapeType.Box)).toBe(true)
  })

  it('rebounds higher with a higher restitution', () => {
    const drop = (restitution: number): number => {
      const mode = make()
      mode.init({ seed: 7, params: params({ bodyCount: 1, boxFraction: 0, restitution, containerSize: 20, gravity: 12 }) })
      let peakAfterSettleWindow = -Infinity
      // Let it hit the floor first, then track the rebound peak.
      step(mode, 120)
      for (let f = 0; f < 180; f++) {
        mode.step(1 / 90)
        peakAfterSettleWindow = Math.max(peakAfterSettleWindow, mode.getBuffers().positions[1])
      }
      return peakAfterSettleWindow
    }
    const bouncy = drop(0.9)
    const dead = drop(0.05)
    expect(bouncy).toBeGreaterThan(dead)
  })

  it('seeds an identical scenario for the same seed (deterministic setup)', () => {
    // Body placement, shapes and sizes are RNG-driven — the same seed must reproduce the same
    // scene bit-for-bit. (This is the part the lab owns; Rapier's contact solver evolution is
    // deterministic-enough for sharing but, being chaotic under stacking, is not asserted
    // bit-exact across two independently-constructed worlds — see the free-fall test below.)
    const a = make()
    const b = make()
    const p = params({ bodyCount: 24, gravity: 10, boxFraction: 0.5 })
    a.init({ seed: 9, params: p })
    b.init({ seed: 9, params: p })
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
    expect(Array.from(a.getBuffers().shapeTypes!)).toEqual(Array.from(b.getBuffers().shapeTypes!))
    expect(Array.from(a.getBuffers().halfExtents!)).toEqual(Array.from(b.getBuffers().halfExtents!))
  })

  it('integrates reproducibly in free fall (no contacts ⇒ identical trajectory)', () => {
    const a = make()
    const b = make()
    const p = params({ bodyCount: 1, boxFraction: 0, containerSize: 30 }) // one ball, far from any wall
    a.init({ seed: 9, params: p })
    b.init({ seed: 9, params: p })
    step(a, 24) // ~0.27 s of pure fall — nowhere near the floor
    step(b, 24)
    const pa = a.getBuffers().positions
    const pb = b.getBuffers().positions
    for (let i = 0; i < pa.length; i++) expect(pa[i]).toBeCloseTo(pb[i], 5)
  })

  it('reports a sane telemetry summary, flagged inelastic', () => {
    const mode = make()
    mode.init({ seed: 1, params: params({ bodyCount: 12 }) })
    step(mode, 30)
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(12)
    expect(t.kineticEnergy).toBeGreaterThanOrEqual(0)
    expect(t.averageSpeed).toBeGreaterThanOrEqual(0)
    expect(t.inelastic).toBe(true)
  })

  it('registers with the rigid-body contract metadata', () => {
    const mode = make()
    expect(mode.id).toBe('rigid-bodies')
    expect(mode.backend).toBe('rapier')
    expect(typeof mode.label).toBe('string')
  })

  it('frees the world on dispose and can be re-initialised', () => {
    const mode = make()
    mode.init({ seed: 1, params: params({ bodyCount: 10 }) })
    mode.dispose()
    expect(() => mode.init({ seed: 2, params: params({ bodyCount: 8 }) })).not.toThrow()
    expect(mode.getBuffers().count).toBe(8)
  })
})
