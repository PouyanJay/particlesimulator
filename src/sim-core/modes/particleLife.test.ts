import { describe, it, expect } from 'vitest'
import { createParticleLifeMode, particleLifeSchema } from './particleLife'
import { defaultParamValues } from '../paramSchema'
import type { ParamValues, SimContext } from '../types'

type Params = ParamValues<typeof particleLifeSchema>

function ctx(overrides: Partial<Params> = {}, seed = 1): SimContext<typeof particleLifeSchema> {
  return { seed, params: { ...defaultParamValues(particleLifeSchema), ...overrides } }
}

describe('particleLife mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createParticleLifeMode()
    expect(mode.id).toBe('particle-life')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(particleLifeSchema)
  })

  it('initialises position and type buffers sized to the particle count', () => {
    const mode = createParticleLifeMode()
    mode.init(ctx({ particleCount: 120, numTypes: 4 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(120)
    expect(b.positions.length).toBe(360)
    expect(b.types?.length).toBe(120)
  })

  it('assigns every particle a type in [0, numTypes)', () => {
    const mode = createParticleLifeMode()
    mode.init(ctx({ particleCount: 200, numTypes: 5 }))
    const types = mode.getBuffers().types!
    for (let i = 0; i < types.length; i++) {
      expect(types[i]).toBeGreaterThanOrEqual(0)
      expect(types[i]).toBeLessThan(5)
    }
  })

  it('starts every particle inside the container', () => {
    const mode = createParticleLifeMode()
    mode.init(ctx({ particleCount: 300, containerSize: 4, particleRadius: 0.05 }))
    const { positions } = mode.getBuffers()
    const bound = 4 / 2 - 0.05
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-6)
    }
  })

  it('is deterministic: same seed yields identical state after N steps', () => {
    const a = createParticleLifeMode()
    const b = createParticleLifeMode()
    a.init(ctx({ particleCount: 150 }, 42))
    b.init(ctx({ particleCount: 150 }, 42))
    for (let i = 0; i < 120; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('produces different matrices/initial states for different seeds', () => {
    const a = createParticleLifeMode()
    const b = createParticleLifeMode()
    a.init(ctx({ particleCount: 150 }, 1))
    b.init(ctx({ particleCount: 150 }, 2))
    for (let i = 0; i < 60; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).not.toEqual(Array.from(b.getBuffers().positions))
  })

  it('stays bounded and finite over a long run (friction prevents blow-up)', () => {
    const containerSize = 4
    const radius = 0.05
    const bound = containerSize / 2 - radius
    const mode = createParticleLifeMode()
    mode.init(ctx({ particleCount: 400, containerSize, particleRadius: radius }))
    for (let i = 0; i < 1000; i++) mode.step(1 / 90)
    const { positions } = mode.getBuffers()
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  it('reports telemetry with the particle count', () => {
    const mode = createParticleLifeMode()
    mode.init(ctx({ particleCount: 90 }))
    expect(mode.getTelemetry().particleCount).toBe(90)
  })
})
