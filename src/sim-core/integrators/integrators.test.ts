import { describe, it, expect } from 'vitest'
import { semiImplicitEuler, velocityVerlet, type AccelFn, type Integrator } from './integrators'

// 1-D simple harmonic oscillator: a(x) = -omega^2 * x. Analytic: x(t) = x0*cos(omega t).
// Total energy E = 0.5 v^2 + 0.5 omega^2 x^2 is conserved exactly in the continuous system.
const omega = 1
const harmonic: AccelFn = (pos, out) => {
  out[0] = -omega * omega * pos[0]
}

const energy = (pos: Float64Array, vel: Float64Array): number =>
  0.5 * vel[0] * vel[0] + 0.5 * omega * omega * pos[0] * pos[0]

function integrateTo(make: (dim: number) => Integrator, T: number, dt: number): Float64Array {
  const integ = make(1)
  const pos = new Float64Array([1]) // x0 = 1
  const vel = new Float64Array([0]) // v0 = 0
  const steps = Math.round(T / dt)
  for (let i = 0; i < steps; i++) integ.step(pos, vel, harmonic, dt)
  return pos
}

describe.each([
  ['semiImplicitEuler', semiImplicitEuler],
  ['velocityVerlet', velocityVerlet],
] as const)('%s', (_name, make) => {
  it('advances a force-free particle linearly with constant velocity', () => {
    const integ = make(1)
    const pos = new Float64Array([0])
    const vel = new Float64Array([2])
    const zero: AccelFn = (_p, out) => (out[0] = 0)
    for (let i = 0; i < 10; i++) integ.step(pos, vel, zero, 0.1)
    expect(pos[0]).toBeCloseTo(2.0, 10) // 2 * (10 * 0.1)
    expect(vel[0]).toBeCloseTo(2.0, 10)
  })

  it('conserves oscillator energy with no secular drift (symplectic)', () => {
    const integ = make(1)
    const pos = new Float64Array([1])
    const vel = new Float64Array([0])
    const dt = 0.01
    const e0 = energy(pos, vel)
    const steps = Math.round((1000 * 2 * Math.PI) / dt) // ~1000 periods
    let maxRelErr = 0
    for (let i = 0; i < steps; i++) {
      integ.step(pos, vel, harmonic, dt)
      maxRelErr = Math.max(maxRelErr, Math.abs(energy(pos, vel) - e0) / e0)
    }
    // Bounded (not growing) energy error is the symplectic property we require.
    expect(maxRelErr).toBeLessThan(0.02)
  })
})

describe('convergence order (error vs analytic at fixed T)', () => {
  const T = 1.0
  const analytic = Math.cos(omega * T)
  const err = (make: (d: number) => Integrator, dt: number) =>
    Math.abs(integrateTo(make, T, dt)[0] - analytic)

  it('velocity Verlet is ~2nd order (error drops ~4x when dt halves)', () => {
    const ratio = err(velocityVerlet, 0.01) / err(velocityVerlet, 0.005)
    expect(ratio).toBeGreaterThan(3.5)
  })

  it('semi-implicit Euler is ~1st order (error drops ~2x when dt halves)', () => {
    const ratio = err(semiImplicitEuler, 0.01) / err(semiImplicitEuler, 0.005)
    expect(ratio).toBeGreaterThan(1.7)
    expect(ratio).toBeLessThan(2.4)
  })
})
