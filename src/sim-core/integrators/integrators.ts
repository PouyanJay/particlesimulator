/**
 * Numerical integrators for the simulation core.
 *
 * Both integrators here are **symplectic** (energy-bounded, no secular drift) which is
 * what an educational/accurate lab needs for long-running conservative systems:
 *  - `semiImplicitEuler` — 1st order, cheap; the default for most modes.
 *  - `velocityVerlet`    — 2nd order; used for energy-sensitive modes (MD, N-body).
 *
 * We deliberately avoid RK4 for conservative/stiff systems: it is more accurate per
 * step but not symplectic, so energy drifts over long runs (see CLAUDE.md).
 *
 * State is held in flat Float64Arrays (length = degrees of freedom = 3 * N for 3-D
 * particles). Integrators own their scratch buffers so `step` allocates nothing.
 */

/** Writes the acceleration for the given positions into `out` (same length). */
export type AccelFn = (positions: Readonly<Float64Array>, out: Float64Array) => void

export interface Integrator {
  /** Advance `pos`/`vel` in place by one fixed `dt`, using `accel` for the force field. */
  step(pos: Float64Array, vel: Float64Array, accel: AccelFn, dt: number): void
}

/**
 * Semi-implicit (symplectic) Euler:
 *   v_{n+1} = v_n + a(x_n) * dt
 *   x_{n+1} = x_n + v_{n+1} * dt
 */
export function semiImplicitEuler(dim: number): Integrator {
  const acc = new Float64Array(dim)
  return {
    step(pos, vel, accel, dt) {
      accel(pos, acc)
      for (let i = 0; i < dim; i++) {
        vel[i] += acc[i] * dt
        pos[i] += vel[i] * dt
      }
    },
  }
}

/**
 * Velocity Verlet:
 *   x_{n+1} = x_n + v_n*dt + 0.5*a(x_n)*dt^2
 *   v_{n+1} = v_n + 0.5*(a(x_n) + a(x_{n+1}))*dt
 */
export function velocityVerlet(dim: number): Integrator {
  const a0 = new Float64Array(dim)
  const a1 = new Float64Array(dim)
  return {
    step(pos, vel, accel, dt) {
      accel(pos, a0)
      const halfDtSq = 0.5 * dt * dt
      for (let i = 0; i < dim; i++) {
        pos[i] += vel[i] * dt + a0[i] * halfDtSq
      }
      accel(pos, a1)
      const halfDt = 0.5 * dt
      for (let i = 0; i < dim; i++) {
        vel[i] += (a0[i] + a1[i]) * halfDt
      }
    },
  }
}
