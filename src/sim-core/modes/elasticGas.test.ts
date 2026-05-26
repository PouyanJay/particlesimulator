import { describe, it, expect } from 'vitest'
import { createElasticGasMode, elasticGasSchema } from './elasticGas'
import type { ParamValues, SimContext } from '../types'

type GasParams = ParamValues<typeof elasticGasSchema>

function ctx(overrides: Partial<GasParams> = {}, seed = 1): SimContext<typeof elasticGasSchema> {
  const params = {
    particleCount: elasticGasSchema.particleCount.default,
    particleRadius: elasticGasSchema.particleRadius.default,
    initialVelocity: elasticGasSchema.initialVelocity.default,
    restitution: elasticGasSchema.restitution.default,
    containerSize: elasticGasSchema.containerSize.default,
    gravity: elasticGasSchema.gravity.default,
    ...overrides,
  }
  return { seed, params }
}

const totalKE = (mode: ReturnType<typeof createElasticGasMode>): number =>
  mode.getTelemetry().kineticEnergy

describe('elasticGas mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createElasticGasMode()
    expect(mode.id).toBe('elastic-gas')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(elasticGasSchema)
  })

  it('initialises buffers sized to the particle count', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 50, particleRadius: 0.1 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(50)
    expect(b.positions.length).toBe(150)
    expect(b.velocities?.length).toBe(150)
    expect(b.radius).toBe(0.1)
  })

  it('exposes per-particle velocities consistent with the reported average speed', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 100, initialVelocity: 2 }))
    const { count, velocities } = mode.getBuffers()
    expect(velocities).toBeDefined()
    let speedSum = 0
    for (let i = 0; i < count; i++) {
      const vx = velocities![i * 3]
      const vy = velocities![i * 3 + 1]
      const vz = velocities![i * 3 + 2]
      speedSum += Math.sqrt(vx * vx + vy * vy + vz * vz)
    }
    // Same underlying state as telemetry, so the mean speeds must agree (Float32 tol).
    expect(speedSum / count).toBeCloseTo(mode.getTelemetry().averageSpeed, 5)
  })

  it('starts every particle inside the container', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 200, containerSize: 2.5, particleRadius: 0.08 }))
    const { positions } = mode.getBuffers()
    const bound = 2.5 / 2 - 0.08
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-6)
    }
  })

  it('keeps every particle inside the container after many steps (wall containment)', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 100, containerSize: 2.5, particleRadius: 0.08, initialVelocity: 3 }))
    for (let i = 0; i < 600; i++) mode.step(1 / 90)
    const { positions } = mode.getBuffers()
    const bound = 2.5 / 2 - 0.08
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  it('conserves total kinetic energy with elastic walls and no gravity (restitution = 1)', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 120, restitution: 1, gravity: 0, initialVelocity: 2 }))
    const e0 = totalKE(mode)
    expect(e0).toBeGreaterThan(0)
    let maxRelErr = 0
    for (let i = 0; i < 500; i++) {
      mode.step(1 / 90)
      maxRelErr = Math.max(maxRelErr, Math.abs(totalKE(mode) - e0) / e0)
    }
    expect(maxRelErr).toBeLessThan(1e-6)
  })

  it('is deterministic: same seed + params yield identical state after N steps', () => {
    const a = createElasticGasMode()
    const b = createElasticGasMode()
    a.init(ctx({ particleCount: 64 }, 42))
    b.init(ctx({ particleCount: 64 }, 42))
    for (let i = 0; i < 200; i++) {
      a.step(1 / 90)
      b.step(1 / 90)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
    // Also compare the Float64-derived telemetry exactly — this catches divergence below
    // the Float32 render-buffer epsilon (CLAUDE.md requires bit-for-bit CPU determinism).
    expect(a.getTelemetry()).toEqual(b.getTelemetry())
  })

  it('produces different initial states for different seeds', () => {
    const a = createElasticGasMode()
    const b = createElasticGasMode()
    a.init(ctx({ particleCount: 64 }, 1))
    b.init(ctx({ particleCount: 64 }, 2))
    expect(Array.from(a.getBuffers().positions)).not.toEqual(Array.from(b.getBuffers().positions))
  })

  it('reports telemetry consistent with the initial velocity setting', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 100, initialVelocity: 2 }))
    const t = mode.getTelemetry()
    expect(t.particleCount).toBe(100)
    expect(t.averageSpeed).toBeGreaterThan(0)
    expect(t.averageSpeed).toBeLessThanOrEqual(2 + 1e-9)
  })

  it('loses kinetic energy over time when restitution < 1', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 120, restitution: 0.8, gravity: 0, initialVelocity: 2 }))
    const e0 = totalKE(mode)
    for (let i = 0; i < 1500; i++) mode.step(1 / 90)
    expect(totalKE(mode)).toBeLessThan(e0)
  })
})

describe('elasticGas physics invariants', () => {
  // For a 3-D Maxwell–Boltzmann speed distribution, <v>^2 / <v^2> = 8 / (3*pi).
  const MB_MOMENT_RATIO = 8 / (3 * Math.PI) // ≈ 0.8488

  it('thermalises toward the Maxwell–Boltzmann speed distribution', { timeout: 30000 }, () => {
    const mode = createElasticGasMode()
    mode.init(
      ctx({ particleCount: 400, particleRadius: 0.09, containerSize: 2.5, initialVelocity: 1, restitution: 1, gravity: 0 }),
    )
    // Initial speeds are a narrow band (ratio ≈ 0.96); collisions should redistribute
    // them toward Maxwell–Boltzmann (ratio ≈ 0.849). Thermalise, then time-average the
    // moments from telemetry: <v> = averageSpeed, <v^2> = 2*KE/N (mass = 1).
    for (let i = 0; i < 4000; i++) mode.step(1 / 90)
    let meanSpeedAcc = 0
    let meanSquareAcc = 0
    const snapshots = 80
    for (let s = 0; s < snapshots; s++) {
      for (let i = 0; i < 5; i++) mode.step(1 / 90)
      const t = mode.getTelemetry()
      meanSpeedAcc += t.averageSpeed
      meanSquareAcc += (2 * t.kineticEnergy) / t.particleCount
    }
    const ratio = (meanSpeedAcc / snapshots) ** 2 / (meanSquareAcc / snapshots)
    // Brackets the MB value while excluding the un-thermalised narrow band (~0.96).
    expect(ratio).toBeGreaterThan(0.81)
    expect(ratio).toBeLessThan(0.88)
    expect(ratio).toBeCloseTo(MB_MOMENT_RATIO, 1)
  })

  it('does not gain mechanical energy under gravity and stays contained (dissipative clamp)', () => {
    const containerSize = 2.5
    const radius = 0.08
    const gMag = 9.81
    const bound = containerSize / 2 - radius
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 80, containerSize, particleRadius: radius, initialVelocity: 1, restitution: 1, gravity: 9.81 }))

    // Mechanical energy E = KE + PE, with PE = sum m*g*(y + bound) >= 0.
    const mechanicalEnergy = (): number => {
      const { positions } = mode.getBuffers()
      let pe = 0
      for (let i = 0; i < positions.length; i += 3) pe += gMag * (positions[i + 1] + bound)
      return mode.getTelemetry().kineticEnergy + pe
    }

    const e0 = mechanicalEnergy()
    let maxE = e0
    for (let i = 0; i < 2000; i++) {
      mode.step(1 / 90)
      maxE = Math.max(maxE, mechanicalEnergy())
    }
    const { positions } = mode.getBuffers()
    expect(Number.isFinite(maxE)).toBe(true)
    // Energy must never blow up (symplectic transient stays small) ...
    expect(maxE).toBeLessThanOrEqual(e0 * 1.02)
    // ... and the hard clamp is dissipative, so it trends down over many floor bounces.
    expect(mechanicalEnergy()).toBeLessThan(e0)
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  // Note: whole-system momentum is covered indirectly — the binary kernel conserves it
  // exactly (see elasticCollision.test.ts) and total-KE conservation would break if the
  // mode wrote velocities back incorrectly. A direct mode-level momentum test isn't
  // feasible through the public API: init() scatters particles to the walls, whose
  // (legitimate) impulses change total momentum during any run long enough to collide.
})

describe('elasticGas conserved-quantity telemetry', () => {
  it('reports momentum, temperature, and pressure', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 100 }))
    const t = mode.getTelemetry()
    expect(t.momentum).toHaveLength(3)
    expect(t.temperature).toBeGreaterThan(0)
    expect(t.pressure).toBeDefined()
  })

  it('reports temperature consistent with equipartition T = 2·KE / (3·N)', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 200, initialVelocity: 2 }))
    const t = mode.getTelemetry()
    expect(t.temperature!).toBeCloseTo((2 * t.kineticEnergy) / (3 * t.particleCount), 6)
  })

  it('flags inelastic runs (restitution < 1 or gravity), not the elastic default', () => {
    const elastic = createElasticGasMode()
    elastic.init(ctx())
    expect(elastic.getTelemetry().inelastic).toBe(false)

    const damped = createElasticGasMode()
    damped.init(ctx({ restitution: 0.8 }))
    expect(damped.getTelemetry().inelastic).toBe(true)

    const withGravity = createElasticGasMode()
    withGravity.init(ctx({ gravity: 9.81 }))
    expect(withGravity.getTelemetry().inelastic).toBe(true)
  })

  it('measures zero pressure before stepping, positive pressure once walls are struck', () => {
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: 200, initialVelocity: 3, containerSize: 2.5, particleRadius: 0.05 }))
    expect(mode.getTelemetry().pressure).toBe(0)
    for (let i = 0; i < 600; i++) mode.step(1 / 90)
    expect(mode.getTelemetry().pressure!).toBeGreaterThan(0)
  })

  it('satisfies the ideal-gas law P·V = N·k_B·T for a dilute elastic gas (k_B = 1)', () => {
    // The acceptance test for the pressure measurement: kinetic theory predicts
    // P·V = N·k_B·T for point-like elastic particles. Tiny radius ⇒ negligible excluded
    // volume; the wall-impulse pressure, the box volume, N and the kinetic temperature must
    // therefore agree to within sampling noise. A wrong impulse factor or area would fail.
    const containerSize = 3
    const radius = 0.02
    const count = 400
    const mode = createElasticGasMode()
    mode.init(ctx({ particleCount: count, particleRadius: radius, containerSize, initialVelocity: 2.5, restitution: 1, gravity: 0 }))
    mode.getTelemetry() // reset the pressure window so it averages only the run below
    for (let i = 0; i < 3000; i++) mode.step(1 / 90)
    const t = mode.getTelemetry()
    const lEff = containerSize - 2 * radius // particle centres bounce in this box
    const pv = t.pressure! * lEff ** 3
    const nkt = t.particleCount * t.temperature! // k_B = 1
    expect(pv / nkt).toBeGreaterThan(0.8)
    expect(pv / nkt).toBeLessThan(1.2)
  })
})
