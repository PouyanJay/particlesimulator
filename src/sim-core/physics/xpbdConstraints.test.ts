import { describe, it, expect } from 'vitest'
import { solveDistanceConstraints } from './xpbdConstraints'
import { accumulateSpringForces } from './springForce'
import { semiImplicitEuler } from '../integrators/integrators'

/** Distance between two nodes in a flat xyz buffer. */
function sep(p: Float64Array, i: number, j: number): number {
  const a = i * 3
  const b = j * 3
  return Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2])
}

describe('solveDistanceConstraints — XPBD position projection', () => {
  it('drives two free equal masses exactly to the rest length in one rigid (compliance 0) sweep', () => {
    // Overstretched: 3 apart, rest 2. Equal inverse mass ⇒ each moves half ⇒ end 2 apart.
    const positions = new Float64Array([-1.5, 0, 0, 1.5, 0, 0])
    const invMass = new Float64Array([1, 1])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    expect(sep(positions, 0, 1)).toBeCloseTo(2, 10)
    // Symmetric: nodes land at ∓1.
    expect(positions[0]).toBeCloseTo(-1, 10)
    expect(positions[3]).toBeCloseTo(1, 10)
  })

  it('holds a pinned endpoint (inverse mass 0) fixed and moves only the free node', () => {
    const positions = new Float64Array([0, 0, 0, 3, 0, 0]) // sep 3, rest 2
    const invMass = new Float64Array([0, 1]) // node 0 pinned
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    expect(positions[0]).toBe(0) // pinned, untouched
    expect(positions[1]).toBe(0)
    expect(positions[2]).toBe(0)
    expect(sep(positions, 0, 1)).toBeCloseTo(2, 10)
    expect(positions[3]).toBeCloseTo(2, 10) // free node pulled in to rest distance
  })

  it('moves the lighter node more, in inverse-mass proportion', () => {
    const positions = new Float64Array([-2, 0, 0, 2, 0, 0]) // sep 4, rest 2 ⇒ total correction 2
    const invMass = new Float64Array([1, 3]) // node 1 three times lighter
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    const x0 = [positions[0], positions[3]]
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    const move0 = Math.abs(positions[0] - x0[0])
    const move1 = Math.abs(positions[3] - x0[1])
    expect(move1 / move0).toBeCloseTo(3, 10)
    expect(sep(positions, 0, 1)).toBeCloseTo(2, 10)
  })

  it('conserves the centre of mass (Σ mᵢ·Δxᵢ = 0) under a rigid projection', () => {
    const positions = new Float64Array([-2, 0.5, 0, 1, -0.5, 0.3]) // arbitrary, off-axis
    const invMass = new Float64Array([1, 2]) // masses 1 and 1/2
    const m0 = 1 / invMass[0]
    const m1 = 1 / invMass[1]
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    const com = (p: Float64Array, axis: number): number =>
      (m0 * p[axis] + m1 * p[3 + axis]) / (m0 + m1)
    const before = [com(positions, 0), com(positions, 1), com(positions, 2)]
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    expect(com(positions, 0)).toBeCloseTo(before[0], 10)
    expect(com(positions, 1)).toBeCloseTo(before[1], 10)
    expect(com(positions, 2)).toBeCloseTo(before[2], 10)
  })

  it('leaves a residual stretch with positive compliance (softer than rigid)', () => {
    const make = (): { p: Float64Array; l: Float64Array } => ({
      p: new Float64Array([-1.5, 0, 0, 1.5, 0, 0]),
      l: new Float64Array([1]),
    })
    const edges = new Uint32Array([0, 1])
    const invMass = new Float64Array([1, 1])
    const restLengths = new Float64Array([2])

    const rigid = make()
    solveDistanceConstraints(rigid.p, invMass, edges, restLengths, new Float64Array([0]), 0, 1)
    const soft = make()
    solveDistanceConstraints(soft.p, invMass, edges, restLengths, new Float64Array([0]), 0.5, 1)

    const rigidErr = Math.abs(sep(rigid.p, 0, 1) - 2)
    const softErr = Math.abs(sep(soft.p, 0, 1) - 2)
    expect(rigidErr).toBeLessThan(1e-9) // rigid fully satisfies
    expect(softErr).toBeGreaterThan(rigidErr) // compliant constraint stays stretched
  })

  it('accumulates the Lagrange multiplier (starts at 0, becomes non-zero after a sweep)', () => {
    const positions = new Float64Array([-1.5, 0, 0, 1.5, 0, 0])
    const invMass = new Float64Array([1, 1])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    expect(lambdas[0]).not.toBe(0)
  })

  it('is a no-op for a fully pinned edge (both inverse masses 0) — no NaN', () => {
    const positions = new Float64Array([0, 0, 0, 3, 0, 0])
    const invMass = new Float64Array([0, 0])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const lambdas = new Float64Array([0])
    solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, 0, 1)
    expect(Array.from(positions)).toEqual([0, 0, 0, 3, 0, 0])
    expect(Number.isFinite(lambdas[0])).toBe(true)
  })

  it('reduces the total constraint error of a chain when swept repeatedly', () => {
    // Three nodes, two springs, all overstretched. One sweep helps; several reduce error further.
    const build = (): Float64Array => new Float64Array([-3, 0, 0, 0, 0, 0, 3, 0, 0])
    const invMass = new Float64Array([1, 1, 1])
    const edges = new Uint32Array([0, 1, 1, 2])
    const restLengths = new Float64Array([2, 2])
    const totalError = (p: Float64Array): number => Math.abs(sep(p, 0, 1) - 2) + Math.abs(sep(p, 1, 2) - 2)

    const oneSweep = build()
    solveDistanceConstraints(oneSweep, invMass, edges, restLengths, new Float64Array(2), 0, 1)

    const manySweeps = build()
    const lambdas = new Float64Array(2)
    for (let k = 0; k < 20; k++) solveDistanceConstraints(manySweeps, invMass, edges, restLengths, lambdas, 0, 1)

    expect(totalError(manySweeps)).toBeLessThan(totalError(oneSweep))
    expect(totalError(manySweeps)).toBeLessThan(1e-6)
  })

  it('drives the rigid-constraint residual monotonically toward zero as iterations increase', () => {
    // A pinned chain (node 0 fixed), all springs overstretched. With compliance 0 each extra
    // Gauss-Seidel sweep propagates the correction further along the chain, so the worst-case
    // residual must decrease monotonically and approach zero — the convergence property that
    // gives `iterations` its meaning. (A single constraint converges in one sweep; the point is
    // the *coupled* chain.)
    const invMass = new Float64Array([0, 1, 1, 1, 1]) // node 0 pinned
    const edges = new Uint32Array([0, 1, 1, 2, 2, 3, 3, 4])
    const restLengths = new Float64Array([1, 1, 1, 1])
    const start = (): Float64Array => new Float64Array([0, 0, 0, 2, 0, 0, 4, 0, 0, 6, 0, 0, 8, 0, 0]) // each 2 apart, rest 1
    const maxResidual = (p: Float64Array): number => {
      let m = 0
      for (let e = 0; e < 4; e++) {
        const a = edges[e * 2] * 3
        const b = edges[e * 2 + 1] * 3
        m = Math.max(m, Math.abs(Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) - 1))
      }
      return m
    }

    // Checkpoints are spaced so the comparison clears the initial plateau (from this extreme
    // 2× stretch the far edges aren't reached until corrections propagate down the chain).
    let prevResidual = Infinity
    for (const iters of [1, 8, 32, 64]) {
      const p = start()
      const lambdas = new Float64Array(4)
      for (let k = 0; k < iters; k++) solveDistanceConstraints(p, invMass, edges, restLengths, lambdas, 0, 1)
      const residual = maxResidual(p)
      expect(residual).toBeLessThan(prevResidual) // strictly decreasing across checkpoints
      prevResidual = residual
    }
    expect(prevResidual).toBeLessThan(1e-4) // converged at 64 iterations
  })
})

/**
 * Integration-level properties of XPBD that the cloth mode depends on, verified at the kernel
 * level where the timestep can be controlled directly (the mode hardcodes its substep). The
 * test rig is a single pinned→free node hanging under gravity, stepped with the exact
 * predict → project → velocity-recover loop the mode uses.
 */
describe('XPBD integration — stability & timestep-independence', () => {
  /** Steady-state separation of a pinned node 0 and a free node 1 hanging below it. */
  function hangSeparation(opts: {
    subDt: number
    totalTime: number
    compliance: number
    gravity: number
    damping: number
    iterations: number
    restLength: number
  }): number {
    const { subDt, totalTime, compliance, gravity, damping, iterations, restLength } = opts
    const pos = new Float64Array([0, 0, 0, 0, -restLength, 0])
    const prev = new Float64Array(6)
    const vel = new Float64Array(6)
    const invMass = new Float64Array([0, 1]) // node 0 pinned
    const edges = new Uint32Array([0, 1])
    const rest = new Float64Array([restLength])
    const lambdas = new Float64Array(1)
    const dtSq = subDt * subDt
    const drag = Math.max(0, 1 - damping * subDt)
    const steps = Math.round(totalTime / subDt)
    for (let s = 0; s < steps; s++) {
      prev[3] = pos[3]
      prev[4] = pos[4]
      prev[5] = pos[5]
      vel[4] -= gravity * subDt
      pos[3] += vel[3] * subDt
      pos[4] += vel[4] * subDt
      pos[5] += vel[5] * subDt
      lambdas[0] = 0
      for (let it = 0; it < iterations; it++) solveDistanceConstraints(pos, invMass, edges, rest, lambdas, compliance, dtSq)
      vel[3] = ((pos[3] - prev[3]) / subDt) * drag
      vel[4] = ((pos[4] - prev[4]) / subDt) * drag
      vel[5] = ((pos[5] - prev[5]) / subDt) * drag
    }
    return Math.hypot(pos[3] - pos[0], pos[4] - pos[1], pos[5] - pos[2])
  }

  it('stays bounded where an equivalent force-based spring diverges at the same stiffness and dt', () => {
    const dt = 1 / 120
    const restLength = 1
    const gravity = 9
    const edges = new Uint32Array([0, 1])
    const rest = new Float64Array([restLength])

    // (a) Force-based reference: k=1e5 ⇒ ω≈316, semi-implicit Euler is stable only for
    // dt < 2/ω ≈ 6.3e-3, but dt = 8.3e-3 — past the limit ⇒ the spring oscillates and diverges.
    const k = 1e5
    const pos = new Float64Array([0, 0, 0, 0, -restLength, 0])
    const vel = new Float64Array(6)
    const zeroVel = new Float64Array(6)
    const integrator = semiImplicitEuler(6)
    const accel = (p: Readonly<Float64Array>, out: Float64Array): void => {
      accumulateSpringForces(p, zeroVel, edges, rest, k, 0, out)
      out[4] -= gravity // gravity on the free node only
    }
    let diverged = false
    for (let s = 0; s < 600; s++) {
      integrator.step(pos, vel, accel, dt)
      // Pin node 0 by clamping it back each step (infinite mass).
      pos[0] = 0
      pos[1] = 0
      pos[2] = 0
      vel[0] = 0
      vel[1] = 0
      vel[2] = 0
      if (!Number.isFinite(pos[4]) || Math.abs(pos[4]) > 1e6) {
        diverged = true
        break
      }
    }
    expect(diverged).toBe(true)

    // (b) XPBD at the same dt, rigid (compliance 0), a single iteration: cannot diverge — the
    // free node is projected to the rest distance every step, so the separation stays bounded.
    const sep = hangSeparation({ subDt: dt, totalTime: 600 * dt, compliance: 0, gravity, damping: 0, iterations: 1, restLength })
    expect(Number.isFinite(sep)).toBe(true)
    expect(sep).toBeLessThan(2 * restLength)
  })

  it('produces a timestep-independent steady stretch (the defining XPBD property)', () => {
    // Same compliance and physical time, two very different substep sizes ⇒ the settled stretch
    // must match (XPBD divides compliance by dt², making stiffness independent of the timestep —
    // unlike plain PBD). Also matches the analytic compliant equilibrium extension ≈ m·g·α.
    const opts = { totalTime: 40, compliance: 0.0008, gravity: 9, damping: 3, iterations: 1, restLength: 1 }
    const coarse = hangSeparation({ ...opts, subDt: 1 / 120 })
    const fine = hangSeparation({ ...opts, subDt: 1 / 480 })
    expect(Math.abs(fine - coarse) / coarse).toBeLessThan(2e-3)
    const extension = coarse - opts.restLength
    expect(extension).toBeCloseTo(opts.gravity * opts.compliance, 3) // ≈ m·g·α (m = 1)
  })

  it('stretches more with higher compliance (softer constraint)', () => {
    const opts = { subDt: 1 / 120, totalTime: 40, gravity: 9, damping: 3, iterations: 1, restLength: 1 }
    const stiff = hangSeparation({ ...opts, compliance: 0.0002 })
    const soft = hangSeparation({ ...opts, compliance: 0.002 })
    expect(soft).toBeGreaterThan(stiff)
  })
})
