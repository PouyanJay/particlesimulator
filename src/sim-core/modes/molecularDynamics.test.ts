import { describe, it, expect } from 'vitest'
import { createMolecularDynamicsMode, molecularDynamicsSchema } from './molecularDynamics'
import { defaultParamValues } from '../paramSchema'
import type { ParamValues, SimContext } from '../types'

type Params = ParamValues<typeof molecularDynamicsSchema>

function ctx(overrides: Partial<Params> = {}, seed = 1): SimContext<typeof molecularDynamicsSchema> {
  return { seed, params: { ...defaultParamValues(molecularDynamicsSchema), ...overrides } }
}

/** Total momentum vector (equal unit mass) read from the render velocity buffer. */
function totalMomentum(buffers: { count: number; velocities?: Float32Array }): [number, number, number] {
  const v = buffers.velocities!
  let px = 0
  let py = 0
  let pz = 0
  for (let i = 0; i < buffers.count; i++) {
    px += v[i * 3]
    py += v[i * 3 + 1]
    pz += v[i * 3 + 2]
  }
  return [px, py, pz]
}

describe('molecularDynamics mode', () => {
  it('declares its identity and CPU backend', () => {
    const mode = createMolecularDynamicsMode()
    expect(mode.id).toBe('molecular-dynamics')
    expect(mode.backend).toBe('cpu')
    expect(mode.paramSchema).toBe(molecularDynamicsSchema)
  })

  it('initialises buffers sized to the particle count', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 64 }))
    const b = mode.getBuffers()
    expect(b.count).toBe(64)
    expect(b.positions.length).toBe(64 * 3)
    expect(b.velocities?.length).toBe(64 * 3)
    expect(b.types).toBeUndefined() // colored by speed
  })

  it('starts every atom inside the container with no NaNs', () => {
    const containerSize = 8
    const radius = 0.5 * molecularDynamicsSchema.sigma.default
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, containerSize }))
    const { positions } = mode.getBuffers()
    const bound = containerSize / 2 - radius
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-6)
    }
  })

  it('starts with no overlapping atoms (lattice spacing ≥ 2^(1/6)·σ)', () => {
    const sigma = 1
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 64, sigma, containerSize: 10 }))
    const { positions, count } = mode.getBuffers()
    const rMin = Math.pow(2, 1 / 6) * sigma
    let minSep = Infinity
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[j * 3] - positions[i * 3]
        const dy = positions[j * 3 + 1] - positions[i * 3 + 1]
        const dz = positions[j * 3 + 2] - positions[i * 3 + 2]
        minSep = Math.min(minSep, Math.sqrt(dx * dx + dy * dy + dz * dz))
      }
    }
    // No pair starts closer than the LJ minimum — avoids the repulsive blow-up.
    expect(minSep).toBeGreaterThanOrEqual(rMin - 1e-9)
  })

  it('starts with net center-of-mass momentum ~0', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 1.5 }))
    const [px, py, pz] = totalMomentum(mode.getBuffers())
    const mag = Math.sqrt(px * px + py * py + pz * pz)
    expect(mag).toBeLessThan(1e-4)
  })

  it('conserves total momentum (~0) under internal LJ forces (wall-free window)', () => {
    // LJ pair forces are equal-and-opposite, so with no external impulse total momentum is
    // conserved. Wall reflections *do* change momentum (the wall exerts an impulse), so we
    // verify conservation in a regime where no atom reaches a wall: a tight cluster centred
    // in a large, cold box. The test also asserts the window stayed wall-free.
    const containerSize = 30
    const radius = 0.5 * molecularDynamicsSchema.sigma.default
    const bound = containerSize / 2 - radius
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 64, temperature: 0.4, containerSize, sigma: 1 }))
    let maxMag = 0
    let maxCoord = 0
    for (let i = 0; i < 200; i++) {
      mode.step(1 / 120)
      const b = mode.getBuffers()
      const [px, py, pz] = totalMomentum(b)
      maxMag = Math.max(maxMag, Math.sqrt(px * px + py * py + pz * pz))
      for (let k = 0; k < b.positions.length; k++) maxCoord = Math.max(maxCoord, Math.abs(b.positions[k]))
    }
    // No wall was touched, so any momentum change is pure force-field / float error.
    expect(maxCoord).toBeLessThan(bound)
    // Float32 render-buffer rounding of ~192 components dominates; stays tiny.
    expect(maxMag).toBeLessThan(1e-3)
  })

  it('conserves total energy (KE + PE) with bounded drift over many steps', () => {
    const mode = createMolecularDynamicsMode()
    // Use a denser, fully-interacting configuration away from walls so the test
    // exercises the integrator + force pairing rather than wall bounces.
    mode.init(ctx({ particleCount: 64, temperature: 0.8, containerSize: 6 }))
    const energy = (): number => {
      const t = mode.getTelemetry()
      // Telemetry exposes KE; potential energy is recomputed below from the buffers.
      return t.kineticEnergy + potentialEnergy(mode)
    }
    // Let it settle one step so a(x) is consistent, then track drift.
    mode.step(1 / 60)
    const e0 = energy()
    let maxDrift = 0
    for (let i = 0; i < 300; i++) {
      mode.step(1 / 60)
      maxDrift = Math.max(maxDrift, Math.abs(energy() - e0) / Math.abs(e0))
    }
    // Symplectic velocity Verlet: energy oscillates but does not drift secularly.
    expect(maxDrift).toBeLessThan(0.05)
  })

  it('is deterministic: same seed + params yield identical state after N steps', () => {
    const a = createMolecularDynamicsMode()
    const b = createMolecularDynamicsMode()
    a.init(ctx({ particleCount: 64 }, 42))
    b.init(ctx({ particleCount: 64 }, 42))
    for (let i = 0; i < 150; i++) {
      a.step(1 / 60)
      b.step(1 / 60)
    }
    expect(Array.from(a.getBuffers().positions)).toEqual(Array.from(b.getBuffers().positions))
    expect(a.getTelemetry()).toEqual(b.getTelemetry())
  })

  it('produces different initial states for different seeds', () => {
    const a = createMolecularDynamicsMode()
    const b = createMolecularDynamicsMode()
    a.init(ctx({ particleCount: 64 }, 1))
    b.init(ctx({ particleCount: 64 }, 2))
    // Lattice positions are identical; the seeded thermal velocities differ.
    expect(Array.from(a.getBuffers().velocities!)).not.toEqual(Array.from(b.getBuffers().velocities!))
  })

  it('stays finite and contained over a long run with default parameters', () => {
    const containerSize = molecularDynamicsSchema.containerSize.default
    const radius = 0.5 * molecularDynamicsSchema.sigma.default
    const bound = containerSize / 2 - radius
    const mode = createMolecularDynamicsMode()
    mode.init(ctx())
    for (let i = 0; i < 1000; i++) mode.step(1 / 60)
    const { positions } = mode.getBuffers()
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true)
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(bound + 1e-3)
    }
  })

  it('telemetry.speedSamples has length = count and matches per-particle speeds', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 64, temperature: 1.2 }))
    mode.step(1 / 60)
    const { count, velocities } = mode.getBuffers()
    const t = mode.getTelemetry()
    expect(t.speedSamples?.length).toBe(count)
    expect(t.particleCount).toBe(count)
    let speedSum = 0
    for (let i = 0; i < count; i++) {
      const vx = velocities![i * 3]
      const vy = velocities![i * 3 + 1]
      const vz = velocities![i * 3 + 2]
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz)
      expect(t.speedSamples![i]).toBeCloseTo(speed, 5)
      speedSum += speed
    }
    expect(t.averageSpeed).toBeCloseTo(speedSum / count, 5)
    // kineticEnergy = 1/2 m sum(v^2)
    let keExpected = 0
    for (let i = 0; i < count; i++) {
      const vx = velocities![i * 3]
      const vy = velocities![i * 3 + 1]
      const vz = velocities![i * 3 + 2]
      keExpected += vx * vx + vy * vy + vz * vz
    }
    expect(t.kineticEnergy).toBeCloseTo(0.5 * keExpected, 4)
  })

  it('dispose() empties the buffers', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 64 }))
    mode.dispose()
    expect(mode.getBuffers().count).toBe(0)
  })
})

/**
 * Recompute total LJ potential energy from the render position buffer for the
 * energy-conservation test. Mirrors the mode's force-shifted cutoff: pairs beyond rc
 * contribute nothing, matching the truncated force the integrator actually applies.
 */
function potentialEnergy(mode: ReturnType<typeof createMolecularDynamicsMode>): number {
  const { positions, count } = mode.getBuffers()
  // The energy test fixes these params; read them off the schema defaults it overrides.
  const eps = molecularDynamicsSchema.epsilon.default
  const sigma = molecularDynamicsSchema.sigma.default
  const rc = molecularDynamicsSchema.cutoff.default * sigma
  let pe = 0
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = positions[j * 3] - positions[i * 3]
      const dy = positions[j * 3 + 1] - positions[i * 3 + 1]
      const dz = positions[j * 3 + 2] - positions[i * 3 + 2]
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (r >= rc || r === 0) continue
      const sr6 = (sigma / r) ** 6
      const sr6c = (sigma / rc) ** 6
      const v = 4 * eps * (sr6 * sr6 - sr6)
      const vc = 4 * eps * (sr6c * sr6c - sr6c)
      // Force-shifted energy: V(r) - V(rc) - (r - rc)*F_raw(rc)·(-1)... we approximate the
      // shifted-energy baseline by the force-shift's linear term so it pairs with the
      // truncated force. The constant offset cancels in the drift (we track relative drift).
      const fRawRc = (24 * eps / rc) * (2 * sr6c * sr6c - sr6c)
      pe += v - vc + (r - rc) * fRawRc
    }
  }
  return pe
}

// The grid==brute-force neighbour-sum invariant is verified directly on the pure LJ
// acceleration kernel in `../physics/lennardJonesField.test.ts` (which the mode delegates
// to), where it can be exercised across in/out-of-cutoff configurations independent of the
// mode's lattice/integrator. Keeping it at the kernel level avoids a mode-only test hook.

describe('molecularDynamics thermalises toward Maxwell–Boltzmann', () => {
  // For a 3-D Maxwell–Boltzmann speed distribution, <v>^2 / <v^2> = 8 / (3π) ≈ 0.8488.
  const MB_MOMENT_RATIO = 8 / (3 * Math.PI)

  it('relaxes the speed-moment ratio toward the MB value', { timeout: 30000 }, () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 1.0, containerSize: 9 }))
    // Equilibrate, then time-average the moments from telemetry.
    for (let i = 0; i < 3000; i++) mode.step(1 / 60)
    let meanSpeedAcc = 0
    let meanSquareAcc = 0
    const snapshots = 100
    for (let s = 0; s < snapshots; s++) {
      for (let i = 0; i < 5; i++) mode.step(1 / 60)
      const t = mode.getTelemetry()
      meanSpeedAcc += t.averageSpeed
      meanSquareAcc += (2 * t.kineticEnergy) / t.particleCount
    }
    const ratio = (meanSpeedAcc / snapshots) ** 2 / (meanSquareAcc / snapshots)
    expect(ratio).toBeGreaterThan(0.80)
    expect(ratio).toBeLessThan(0.89)
    expect(ratio).toBeCloseTo(MB_MOMENT_RATIO, 1)
  })
})

describe('molecularDynamics conserved-quantity telemetry', () => {
  it('reports near-zero total momentum at init (centre-of-mass velocity removed)', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 1 }))
    const [px, py, pz] = mode.getTelemetry().momentum!
    expect(Math.hypot(px, py, pz)).toBeLessThan(1e-9)
  })

  it('reports temperature consistent with equipartition T = 2·KE / (3·N)', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 1.2 }))
    const t = mode.getTelemetry()
    expect(t.temperature!).toBeCloseTo((2 * t.kineticEnergy) / (3 * t.particleCount), 6)
  })

  it('measures zero pressure before stepping and positive pressure once the gas runs', () => {
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 1.5, containerSize: 8 }))
    expect(mode.getTelemetry().pressure).toBe(0)
    for (let i = 0; i < 400; i++) mode.step(1 / 60)
    expect(mode.getTelemetry().pressure!).toBeGreaterThan(0)
  })

  it('under gravity the atoms settle downward (sedimentation) and the run is flagged inelastic', () => {
    const meanY = (b: { count: number; positions: Float32Array }) => {
      let sum = 0
      for (let i = 0; i < b.count; i++) sum += b.positions[i * 3 + 1]
      return sum / b.count
    }
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: 0.3, gravity: 5, containerSize: 12 }))
    const before = meanY(mode.getBuffers())
    for (let i = 0; i < 600; i++) mode.step(1 / 60)
    expect(meanY(mode.getBuffers())).toBeLessThan(before - 0.5) // gas sinks under gravity
    expect(mode.getTelemetry().inelastic).toBe(true)
  })

  it('holds the kinetic temperature at the target when the lock is on', () => {
    const target = 1.5
    const mode = createMolecularDynamicsMode()
    mode.init(ctx({ particleCount: 125, temperature: target, holdTemperature: true }))
    // LJ exchanges KE with potential energy, which would pull the kinetic temperature off
    // target; the thermostat lock pins it back each frame.
    for (let i = 0; i < 300; i++) mode.step(1 / 60)
    expect(mode.getTelemetry().temperature!).toBeCloseTo(target, 2)
  })
})
