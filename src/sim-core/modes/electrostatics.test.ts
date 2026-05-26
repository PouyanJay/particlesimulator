import { describe, it, expect } from 'vitest'
import { createElectrostaticsMode, electrostaticsSchema } from './electrostatics'
import { defaultParamValues } from '../paramSchema'
import type { ParamValues, SimContext } from '../types'

type Params = ParamValues<typeof electrostaticsSchema>

function ctx(overrides: Partial<Params> = {}, seed = 1): SimContext<typeof electrostaticsSchema> {
  return { seed, params: { ...defaultParamValues(electrostaticsSchema), ...overrides } }
}

describe('electrostatics mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createElectrostaticsMode()
    expect(mode.id).toBe('electrostatics')
    expect(mode.label).toBe('Electrostatics')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(electrostaticsSchema)
  })

  it('initialises position/velocity buffers and a per-charge type sized to the count', () => {
    const mode = createElectrostaticsMode()
    mode.init(ctx({ particleCount: 100 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(100)
    expect(b.positions.length).toBe(300)
    expect(b.velocities?.length).toBe(300)
    expect(b.types?.length).toBe(100) // colored by charge sign
  })

  it('assigns each particle a charge sign type that is only 0 (negative) or 1 (positive)', () => {
    const mode = createElectrostaticsMode()
    mode.init(ctx({ particleCount: 500 }))
    const types = mode.getBuffers().types
    expect(types).toBeDefined()
    if (!types) return
    let positives = 0
    for (const t of types) {
      expect(t === 0 || t === 1).toBe(true)
      if (t === 1) positives++
    }
    // Roughly half positive, half negative (loose bounds — it's a seeded coin flip).
    expect(positives).toBeGreaterThan(150)
    expect(positives).toBeLessThan(350)
  })

  it('is deterministic: same seed yields identical state after N steps', () => {
    const a = createElectrostaticsMode()
    const b = createElectrostaticsMode()
    a.init(ctx({ particleCount: 120 }, 7))
    b.init(ctx({ particleCount: 120 }, 7))
    for (let i = 0; i < 100; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('produces different states for different seeds', () => {
    const a = createElectrostaticsMode()
    const b = createElectrostaticsMode()
    a.init(ctx({ particleCount: 120 }, 1))
    b.init(ctx({ particleCount: 120 }, 2))
    for (let i = 0; i < 50; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).not.toEqual(Array.from(b.getBuffers().positions))
  })

  it('conserves total momentum under the internal Coulomb forces (wall-free window)', () => {
    // Use a huge container so no particle reaches a wall over this window — the only
    // forces acting are the pairwise (equal-and-opposite) Coulomb forces, so Σ m·v is fixed.
    const mode = createElectrostaticsMode()
    mode.init(ctx({ particleCount: 150, containerSize: 1000, initialSpeed: 0.5 }, 3))
    const before = mode.getTelemetry().momentum
    expect(before).toBeDefined()
    for (let i = 0; i < 200; i++) mode.step(1 / 120)
    const after = mode.getTelemetry().momentum
    expect(after).toBeDefined()
    if (!before || !after) return
    for (let axis = 0; axis < 3; axis++) {
      expect(after[axis]).toBeCloseTo(before[axis], 6)
    }
  })

  it('stays finite and contained over a long run with default parameters (stable defaults)', () => {
    const containerSize = defaultParamValues(electrostaticsSchema).containerSize as number
    const radius = defaultParamValues(electrostaticsSchema).particleRadius as number
    const bound = containerSize / 2 - radius
    const mode = createElectrostaticsMode()
    mode.init(ctx())
    for (let i = 0; i < 1500; i++) mode.step(1 / 90)
    const { positions } = mode.getBuffers()
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  it('reports telemetry with the count and a momentum vector', () => {
    const mode = createElectrostaticsMode()
    mode.init(ctx({ particleCount: 80 }))
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(80)
    expect(t.momentum).toBeDefined()
    expect(t.momentum?.length).toBe(3)
    expect(t.kineticEnergy).toBeGreaterThanOrEqual(0)
  })
})
