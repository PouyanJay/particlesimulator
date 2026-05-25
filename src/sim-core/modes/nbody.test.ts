import { describe, it, expect } from 'vitest'
import { createNbodyMode, nbodySchema } from './nbody'
import { defaultParamValues } from '../paramSchema'
import type { ParamValues, SimContext } from '../types'

type Params = ParamValues<typeof nbodySchema>

function ctx(overrides: Partial<Params> = {}, seed = 1): SimContext<typeof nbodySchema> {
  return { seed, params: { ...defaultParamValues(nbodySchema), ...overrides } }
}

describe('nbody mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createNbodyMode()
    expect(mode.id).toBe('nbody')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(nbodySchema)
  })

  it('initialises position and velocity buffers sized to the body count', () => {
    const mode = createNbodyMode()
    mode.init(ctx({ particleCount: 100 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(100)
    expect(b.positions.length).toBe(300)
    expect(b.velocities?.length).toBe(300)
    expect(b.types).toBeUndefined() // colored by speed, not type
  })

  it('is deterministic: same seed yields identical state after N steps', () => {
    const a = createNbodyMode()
    const b = createNbodyMode()
    a.init(ctx({ particleCount: 120 }, 7))
    b.init(ctx({ particleCount: 120 }, 7))
    for (let i = 0; i < 100; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('produces different states for different seeds', () => {
    const a = createNbodyMode()
    const b = createNbodyMode()
    a.init(ctx({ particleCount: 120 }, 1))
    b.init(ctx({ particleCount: 120 }, 2))
    for (let i = 0; i < 50; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).not.toEqual(Array.from(b.getBuffers().positions))
  })

  it('stays finite and contained over a long run with default parameters (stable defaults)', () => {
    const containerSize = defaultParamValues(nbodySchema).containerSize as number
    const radius = defaultParamValues(nbodySchema).particleRadius as number
    const bound = containerSize / 2 - radius
    const mode = createNbodyMode()
    mode.init(ctx({ particleCount: 600 }))
    for (let i = 0; i < 1500; i++) mode.step(1 / 90)
    const { positions } = mode.getBuffers()
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  it('reports telemetry with the body count', () => {
    const mode = createNbodyMode()
    mode.init(ctx({ particleCount: 80 }))
    expect(mode.getTelemetry().particleCount).toBe(80)
  })
})
