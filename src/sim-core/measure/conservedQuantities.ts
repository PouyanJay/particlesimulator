/**
 * Conserved / derived bulk quantities computed from a particle system's velocity buffer.
 *
 * Pure and framework-free so modes can share one tested implementation in `getTelemetry`
 * instead of re-deriving momentum/energy/temperature by hand. Velocities are xyz-interleaved
 * (length ≥ 3·count); `mass` is the per-particle mass (equal mass — the sim uses unit mass in
 * reduced units). All formulas use k_B = 1 (reduced units), matching the rest of the lab.
 */

/** Total momentum vector p = Σ m·vᵢ (xyz). Zero for a system whose velocities cancel. */
export function totalMomentum(
  velocities: ArrayLike<number>,
  count: number,
  mass = 1,
): [number, number, number] {
  let px = 0
  let py = 0
  let pz = 0
  for (let i = 0; i < count; i++) {
    const o = i * 3
    px += velocities[o]
    py += velocities[o + 1]
    pz += velocities[o + 2]
  }
  return [px * mass, py * mass, pz * mass]
}

/** Total kinetic energy KE = Σ ½ m |vᵢ|². */
export function kineticEnergy(velocities: ArrayLike<number>, count: number, mass = 1): number {
  let sumSq = 0
  for (let i = 0; i < count; i++) {
    const o = i * 3
    sumSq += velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
  }
  return 0.5 * mass * sumSq
}

/**
 * Temperature from the equipartition theorem in 3-D: each particle carries ⟨½ m v²⟩ = (3/2) k_B T,
 * so with k_B = 1, T = m·⟨v²⟩ / 3. This is the kinetic-theory temperature a thermalised gas
 * settles to — the same T the Maxwell–Boltzmann curve is parameterised by.
 */
export function temperature(velocities: ArrayLike<number>, count: number, mass = 1): number {
  if (count <= 0) return 0
  let sumSq = 0
  for (let i = 0; i < count; i++) {
    const o = i * 3
    sumSq += velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
  }
  return (mass * (sumSq / count)) / 3
}
