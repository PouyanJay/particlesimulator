/**
 * Shared environment behaviours — the physics that the universal "Scene" parameters drive.
 * Extracted so every bounded mode reflects off its walls identically (one implementation,
 * previously copy-pasted across the gas, MD and N-body modes) and so gravity is applied
 * consistently. Pure functions over flat xyz-interleaved buffers; no per-call allocation.
 */

/**
 * Reflect particles off an axis-aligned cube of half-extent `halfBound`, centred at the origin.
 * Clamps each centre back inside and flips the *outward* velocity component (× `restitution`).
 * Returns the total impulse delivered to the walls — Σ m·|v_in|·(1 + restitution) over the
 * reflections this call — which the gas modes integrate over time to measure pressure.
 */
export function reflectInBox(
  positions: Float64Array,
  velocities: Float64Array,
  count: number,
  halfBound: number,
  restitution = 1,
  mass = 1,
): number {
  let wallImpulse = 0
  for (let i = 0; i < count; i++) {
    const o = i * 3
    for (let axis = 0; axis < 3; axis++) {
      const k = o + axis
      if (positions[k] > halfBound && velocities[k] > 0) {
        wallImpulse += mass * velocities[k] * (1 + restitution)
        positions[k] = halfBound
        velocities[k] = -velocities[k] * restitution
      } else if (positions[k] < -halfBound && velocities[k] < 0) {
        wallImpulse += mass * -velocities[k] * (1 + restitution)
        positions[k] = -halfBound
        velocities[k] = -velocities[k] * restitution
      }
    }
  }
  return wallImpulse
}

/**
 * Apply a uniform gravitational field along −Y as a velocity kick: v_y -= g·dt for every
 * particle. `g` is the field strength (0 = off). For semi-implicit-Euler modes this is the
 * integration step for a constant external force; Verlet modes fold the same −g into their
 * acceleration field instead.
 */
export function applyGravity(velocities: Float64Array, count: number, g: number, dt: number): void {
  if (g === 0) return
  const dv = g * dt
  for (let i = 0; i < count; i++) velocities[i * 3 + 1] -= dv
}
