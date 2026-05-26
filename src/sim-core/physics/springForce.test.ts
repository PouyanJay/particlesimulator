import { describe, it, expect } from 'vitest'
import { accumulateSpringForces } from './springForce'
import { semiImplicitEuler } from '../integrators/integrators'

/**
 * Helpers: build the flat buffers for a small spring network and read a node's force.
 */
function force(out: Float64Array, node: number): [number, number, number] {
  const o = node * 3
  return [out[o], out[o + 1], out[o + 2]]
}

describe('accumulateSpringForces — Hooke + damping', () => {
  it('produces zero force when every spring is exactly at its rest length and at rest', () => {
    // Two nodes 2 apart along x, rest length 2 → no strain, no motion → no force.
    const positions = new Float64Array([-1, 0, 0, 1, 0, 0])
    const velocities = new Float64Array(6)
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 10, 0, out)
    expect(force(out, 0)).toEqual([0, 0, 0])
    expect(force(out, 1)).toEqual([0, 0, 0])
  })

  it('pulls a stretched spring back together (restoring force ∝ extension)', () => {
    // Nodes 4 apart, rest length 2 → extension 2. F = k·extension = 10·2 = 20.
    const positions = new Float64Array([-2, 0, 0, 2, 0, 0])
    const velocities = new Float64Array(6)
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 10, 0, out)
    // Node 0 (at −x) is pulled toward +x; node 1 (at +x) toward −x.
    expect(out[0]).toBeCloseTo(20, 10)
    expect(out[3]).toBeCloseTo(-20, 10)
    // No transverse component.
    expect(out[1]).toBeCloseTo(0, 12)
    expect(out[2]).toBeCloseTo(0, 12)
  })

  it('pushes a compressed spring apart', () => {
    // Nodes 1 apart, rest length 2 → compression 1. F = k·1 = 10, outward.
    const positions = new Float64Array([-0.5, 0, 0, 0.5, 0, 0])
    const velocities = new Float64Array(6)
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 10, 0, out)
    expect(out[0]).toBeCloseTo(-10, 10) // node 0 pushed further −x
    expect(out[3]).toBeCloseTo(10, 10) // node 1 pushed further +x
  })

  it('obeys Newton’s third law: equal and opposite forces on the two endpoints', () => {
    // Arbitrary off-axis, stretched, with relative motion — forces must still sum to zero.
    const positions = new Float64Array([0, 0, 0, 3, 4, 0]) // 5 apart
    const velocities = new Float64Array([1, -2, 0.5, -1, 1, 0])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 7, 3, out)
    expect(out[0]).toBeCloseTo(-out[3], 10)
    expect(out[1]).toBeCloseTo(-out[4], 10)
    expect(out[2]).toBeCloseTo(-out[5], 10)
  })

  it('damps along the spring axis, opposing the relative velocity (no stiffness)', () => {
    // At rest length so no elastic force; node 1 receding from node 0 along +x at speed 2.
    const positions = new Float64Array([-1, 0, 0, 1, 0, 0])
    const velocities = new Float64Array([0, 0, 0, 2, 0, 0])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 0, 5, out)
    // Relative velocity of node 1 w.r.t. node 0 along +x is +2 → damping force on node 1
    // is −c·2 = −10 (slows it), and +10 on node 0.
    expect(out[3]).toBeCloseTo(-10, 10)
    expect(out[0]).toBeCloseTo(10, 10)
  })

  it('does not damp transverse (shearing) motion — only motion along the spring', () => {
    // Spring along x; both nodes slide together in +y (no change in separation).
    const positions = new Float64Array([-1, 0, 0, 1, 0, 0])
    const velocities = new Float64Array([0, 3, 0, 0, 3, 0])
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6)
    accumulateSpringForces(positions, velocities, edges, restLengths, 0, 5, out)
    expect(force(out, 0)).toEqual([0, 0, 0])
    expect(force(out, 1)).toEqual([0, 0, 0])
  })

  it('accumulates the contributions of every spring sharing a node', () => {
    // Chain: node1 in the middle, both springs stretched by 1 → equal pulls cancel at node1.
    const positions = new Float64Array([-3, 0, 0, 0, 0, 0, 3, 0, 0])
    const velocities = new Float64Array(9)
    const edges = new Uint32Array([0, 1, 1, 2])
    const restLengths = new Float64Array([2, 2])
    const out = new Float64Array(9)
    accumulateSpringForces(positions, velocities, edges, restLengths, 4, 0, out)
    // Each spring stretched by 1 → F = 4. End nodes pulled inward; middle balanced.
    expect(out[0]).toBeCloseTo(4, 10)
    expect(out[6]).toBeCloseTo(-4, 10)
    expect(force(out, 1)).toEqual([0, 0, 0])
  })

  it('overwrites the output buffer each call (no carry-over)', () => {
    const positions = new Float64Array([-1, 0, 0, 1, 0, 0])
    const velocities = new Float64Array(6)
    const edges = new Uint32Array([0, 1])
    const restLengths = new Float64Array([2])
    const out = new Float64Array(6).fill(99)
    accumulateSpringForces(positions, velocities, edges, restLengths, 10, 0, out)
    expect(force(out, 0)).toEqual([0, 0, 0])
    expect(force(out, 1)).toEqual([0, 0, 0])
  })
})

/**
 * Ground-truth physics: an undamped two-mass spring oscillator. With damping = 0 the spring
 * force depends only on position, so the kernel composes with the (separately verified)
 * symplectic `semiImplicitEuler` integrator exactly as the spring-mass mode drives it. Two
 * equal masses m on a spring k oscillate in their relative coordinate at the reduced-mass
 * frequency ω = √(k/μ), μ = m/2 ⇒ ω = √(2k); a symplectic integrator must keep total energy
 * bounded with no secular drift, conserve momentum (internal forces only), and reproduce ω.
 * The energy band is verified at the schema's default (k = 120) and maximum (k = 400) stiffness
 * — the actual operating envelope — not just a soft spring.
 */
describe('damped-spring kernel — undamped oscillator conservation (symplectic)', () => {
  const REST = 2
  const MASS = 1
  const edges = new Uint32Array([0, 1])
  const restLengths = new Float64Array([REST])
  const zeroVel = new Float64Array(6) // damping = 0 ⇒ velocity term unused by the kernel

  const springAccel =
    (stiffness: number) =>
    (p: Readonly<Float64Array>, out: Float64Array): void =>
      accumulateSpringForces(p, zeroVel, edges, restLengths, stiffness, 0, out)

  /** Total energy E = ½m·Σv² + ½k·(r − L₀)² for the two-node system. */
  function energy(pos: Float64Array, vel: Float64Array, stiffness: number): number {
    let ke = 0
    for (let i = 0; i < 6; i++) ke += 0.5 * MASS * vel[i] * vel[i]
    const r = Math.hypot(pos[0] - pos[3], pos[1] - pos[4], pos[2] - pos[5])
    return ke + 0.5 * stiffness * (r - REST) ** 2
  }

  /**
   * Run a stretched two-mass oscillator at rest (zero initial velocity, so the centre of mass
   * sits at the origin) and report the energy band, the windowed-mean energy drift, and the
   * final COM x — the symplectic diagnostics.
   */
  function oscillatorStats(stiffness: number, dt: number, steps: number) {
    const amplitude = 0.3
    const pos = new Float64Array([-(REST + amplitude) / 2, 0, 0, (REST + amplitude) / 2, 0, 0])
    const vel = new Float64Array(6)
    const integrator = semiImplicitEuler(6)
    const accel = springAccel(stiffness)
    const e0 = energy(pos, vel, stiffness)
    const samples: number[] = []
    let minE = e0
    let maxE = e0
    for (let s = 0; s < steps; s++) {
      integrator.step(pos, vel, accel, dt)
      const e = energy(pos, vel, stiffness)
      samples.push(e)
      minE = Math.min(minE, e)
      maxE = Math.max(maxE, e)
    }
    const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length
    const w = Math.min(1000, Math.floor(steps / 4))
    return {
      band: (maxE - minE) / e0,
      drift: Math.abs(mean(samples.slice(-w)) - mean(samples.slice(0, w))) / e0,
      comX: (pos[0] + pos[3]) / 2,
    }
  }

  it('keeps energy bounded with no secular drift at the default stiffness (k=120)', () => {
    // ω = √240 ≈ 15.5, ω·dt ≈ 0.031 ⇒ instantaneous band ≈ 3%.
    const { band, drift, comX } = oscillatorStats(120, 0.002, 6000)
    expect(band).toBeLessThan(0.05) // bounded ∝ ω·dt
    expect(drift).toBeLessThan(0.005) // the load-bearing invariant: no creep
    expect(comX).toBeCloseTo(0, 8) // no external force ⇒ COM fixed
  })

  it('keeps energy bounded with no secular drift at the maximum schema stiffness (k=400)', () => {
    // ω = √800 ≈ 28.3, ω·dt ≈ 0.057 ⇒ band ≈ 5.7%, still no drift (the real test of stability).
    const { band, drift } = oscillatorStats(400, 0.002, 6000)
    expect(band).toBeLessThan(0.09)
    expect(drift).toBeLessThan(0.005)
  })

  it('conserves total momentum under internal spring forces only (no pins/gravity/walls)', () => {
    // Off-axis, stretched, with a net drift velocity — the kernel's equal-and-opposite forces
    // must leave total momentum p = m·Σv unchanged to machine precision (m = 1).
    const stiffness = 400
    const pos = new Float64Array([-1.3, 0.2, 0, 1.1, -0.1, 0.3])
    const vel = new Float64Array([0.5, 0.2, -0.1, -0.1, 0.3, 0.2])
    const integrator = semiImplicitEuler(6)
    const accel = springAccel(stiffness)
    const p0: [number, number, number] = [vel[0] + vel[3], vel[1] + vel[4], vel[2] + vel[5]]
    for (let s = 0; s < 5000; s++) integrator.step(pos, vel, accel, 0.002)
    expect(vel[0] + vel[3]).toBeCloseTo(p0[0], 9)
    expect(vel[1] + vel[4]).toBeCloseTo(p0[1], 9)
    expect(vel[2] + vel[5]).toBeCloseTo(p0[2], 9)
  })

  it('oscillates at the analytic reduced-mass frequency ω = √(2k)', () => {
    const stiffness = 50
    const amplitude = 0.2
    const pos = new Float64Array([-(REST + amplitude) / 2, 0, 0, (REST + amplitude) / 2, 0, 0])
    const vel = new Float64Array(6)
    const integrator = semiImplicitEuler(6)
    const accel = springAccel(stiffness)

    const dt = 0.002
    const steps = 20000 // many periods ⇒ fine crossing-count resolution
    // Count sign changes of the strain (r − L₀): two per oscillation period.
    let prev = Math.hypot(pos[0] - pos[3], 0, 0) - REST
    let crossings = 0
    for (let s = 0; s < steps; s++) {
      integrator.step(pos, vel, accel, dt)
      const strain = Math.hypot(pos[0] - pos[3], pos[1] - pos[4], pos[2] - pos[5]) - REST
      if (prev <= 0 !== strain <= 0) crossings++
      prev = strain
    }
    const measuredPeriod = (2 * steps * dt) / crossings
    const analyticPeriod = (2 * Math.PI) / Math.sqrt((2 * stiffness) / MASS)
    expect(Math.abs(measuredPeriod - analyticPeriod) / analyticPeriod).toBeLessThan(0.01) // within 1%
  })
})
