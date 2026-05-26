import { describe, it, expect } from 'vitest'
import { createSphFluidMode, sphSchema, deriveSphScale } from './sph'
import { createSphField } from '../physics/sphField'
import type { ParamValues } from '../types'

type Params = ParamValues<typeof sphSchema>

function params(overrides: Partial<Params> = {}): Params {
  const base = Object.fromEntries(Object.entries(sphSchema).map(([k, def]) => [k, def.default])) as Params
  return { ...base, ...overrides }
}

function step(mode: ReturnType<typeof createSphFluidMode>, frames: number, dt = 1 / 90): void {
  for (let f = 0; f < frames; f++) mode.step(dt)
}

function meanY(b: { positions: Float32Array; count: number }): number {
  let s = 0
  for (let i = 0; i < b.count; i++) s += b.positions[i * 3 + 1]
  return s / b.count
}

function extent(b: { positions: Float32Array; count: number }, axis: number): number {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < b.count; i++) {
    const v = b.positions[i * 3 + axis]
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  return hi - lo
}

describe('SPH fluid mode', () => {
  it('creates the requested particle count with render buffers', () => {
    const mode = createSphFluidMode()
    mode.init({ seed: 1, params: params({ particleCount: 300 }) })
    const b = mode.getBuffers()
    expect(b.count).toBe(300)
    expect(b.positions.length).toBe(900)
    expect(b.velocities).toBeDefined()
    expect(b.radius).toBeGreaterThan(0)
  })

  it('falls under gravity and pools in the lower half of the box', () => {
    const mode = createSphFluidMode()
    mode.init({ seed: 1, params: params({ particleCount: 400, containerSize: 12, gravity: 9 }) })
    const y0 = meanY(mode.getBuffers())
    step(mode, 150)
    const y1 = meanY(mode.getBuffers())
    expect(y1).toBeLessThan(y0) // fell
    expect(y1).toBeLessThan(0) // pooled below the box centre
  })

  it('stays finite and contained over a long run (stability)', () => {
    const size = 12
    const mode = createSphFluidMode()
    mode.init({ seed: 2, params: params({ particleCount: 400, containerSize: size, gravity: 9 }) })
    step(mode, 300)
    const b = mode.getBuffers()
    const half = size / 2
    for (let i = 0; i < b.positions.length; i++) {
      expect(Number.isFinite(b.positions[i])).toBe(true)
      expect(Math.abs(b.positions[i])).toBeLessThanOrEqual(half + 1e-6)
    }
  })

  it('behaves as an incompressible liquid: spreads on the floor and settles near rest density', () => {
    const size = 12
    const count = 450
    const restDensity = 1
    const stiffness = sphSchema.stiffness.default
    const viscosity = sphSchema.viscosity.default
    const mode = createSphFluidMode()
    mode.init({ seed: 3, params: params({ particleCount: count, containerSize: size, gravity: 9 }) })
    step(mode, 300)
    const b = mode.getBuffers()
    // A real liquid resists compression: after settling it forms a wide shallow pool, not a
    // clumped point (pressure) and not an exploded cloud (stability).
    expect(extent(b, 0)).toBeGreaterThan(size * 0.3) // spread across the floor in x
    expect(extent(b, 2)).toBeGreaterThan(size * 0.3) // and in z

    // Direct incompressibility: reconstruct the field at the mode's own scale and check the bulk
    // density sits near rest density, and is higher at the bottom of the column (hydrostatic).
    const scale = deriveSphScale(count, size, restDensity)
    const field = createSphField({ mass: scale.mass, restDensity, stiffness, viscosity, smoothingRadius: scale.smoothingRadius })
    const pos = Float64Array.from(b.positions)
    const dens = new Float64Array(count)
    field.computeDensities(pos, count, dens)
    const sorted = [...dens].sort((x, y) => x - y)
    const median = sorted[count >> 1]
    expect(median).toBeGreaterThan(0.75 * restDensity)
    expect(median).toBeLessThan(1.3 * restDensity)
    // Hydrostatic: mean density in the bottom third exceeds the top third.
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < count; i++) {
      lo = Math.min(lo, pos[i * 3 + 1])
      hi = Math.max(hi, pos[i * 3 + 1])
    }
    const third = (hi - lo) / 3
    let bottomSum = 0
    let bottomN = 0
    let topSum = 0
    let topN = 0
    for (let i = 0; i < count; i++) {
      const y = pos[i * 3 + 1]
      if (y < lo + third) {
        bottomSum += dens[i]
        bottomN++
      } else if (y > hi - third) {
        topSum += dens[i]
        topN++
      }
    }
    expect(bottomSum / bottomN).toBeGreaterThan(topSum / topN)
  })

  it('stays bounded in energy even at zero physical viscosity (artificial viscosity stabilises it)', () => {
    // Without dissipation WCSPH self-heats; the always-on artificial viscosity must keep total
    // kinetic energy from growing without bound once the initial fall transient has passed.
    const mode = createSphFluidMode()
    mode.init({ seed: 6, params: params({ particleCount: 350, containerSize: 12, gravity: 12, stiffness: 600, viscosity: 0 }) })
    let peak = 0
    for (let f = 0; f < 350; f++) {
      mode.step(1 / 90)
      peak = Math.max(peak, mode.getTelemetry().kineticEnergy)
    }
    const settledKe = mode.getTelemetry().kineticEnergy
    // A boiling (unstable) fluid ends near its peak or higher; a stabilised one has shed energy.
    expect(settledKe).toBeLessThan(peak * 0.7)
    expect(Number.isFinite(settledKe)).toBe(true)
  })

  it('is deterministic: identical seed and params produce identical trajectories', () => {
    const a = createSphFluidMode()
    const b = createSphFluidMode()
    const p = params({ particleCount: 250, gravity: 9 })
    a.init({ seed: 5, params: p })
    b.init({ seed: 5, params: p })
    step(a, 120)
    step(b, 120)
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
  })

  it('reports a sane telemetry summary flagged inelastic', () => {
    const mode = createSphFluidMode()
    mode.init({ seed: 1, params: params({ particleCount: 200 }) })
    step(mode, 30)
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(200)
    expect(t.kineticEnergy).toBeGreaterThanOrEqual(0)
    expect(t.averageSpeed).toBeGreaterThanOrEqual(0)
    expect(t.inelastic).toBe(true)
  })

  it('registers with the SPH-fluid contract metadata', () => {
    const mode = createSphFluidMode()
    expect(mode.id).toBe('sph-fluid')
    expect(mode.backend).toBe('cpu')
    expect(typeof mode.label).toBe('string')
  })
})
