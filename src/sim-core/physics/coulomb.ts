/**
 * All-pairs Coulomb electrostatic accelerations (equal unit masses, signed charges).
 *
 * For each particle i: a_i = k · Σ_{j≠i} q_i·q_j · (p_i − p_j) / (|p_i − p_j|² + ε²)^{3/2}.
 * The displacement points *from j toward i*, so a positive charge product (like charges)
 * pushes i away from j — repulsion — while a negative product (opposite charges) pulls i
 * toward j — attraction, exactly Coulomb's law. Computed with the i<j symmetry so each pair
 * is evaluated once and contributes equal-and-opposite forces (Newton's 3rd law ⇒ total
 * momentum is conserved). The softening ε² removes the 1/r² singularity at close range,
 * keeping integration stable through near-encounters (mirrors `gravity.ts`).
 *
 * Mass is unit (a = F/m, m = 1), so the per-particle "charge" carries the sign and magnitude.
 * O(N²) — fine for the CPU tier (a few thousand charges); GPU / Barnes-Hut come later.
 *
 * @param positions xyz-interleaved, length 3·count
 * @param charges signed per-particle charge, length count
 * @param count number of particles
 * @param k Coulomb constant (force strength)
 * @param softeningSq ε² (softening length squared)
 * @param out xyz-interleaved accelerations, length 3·count (overwritten)
 */
export function computeCoulombAccelerations(
  positions: Readonly<Float64Array>,
  charges: Readonly<Float64Array>,
  count: number,
  k: number,
  softeningSq: number,
  out: Float64Array,
): void {
  out.fill(0)
  for (let i = 0; i < count; i++) {
    const oi = i * 3
    const qi = charges[i]
    for (let j = i + 1; j < count; j++) {
      const oj = j * 3
      // Displacement i ← j (points from j toward i) so a positive q_i·q_j repels i from j.
      const dx = positions[oi] - positions[oj]
      const dy = positions[oi + 1] - positions[oj + 1]
      const dz = positions[oi + 2] - positions[oj + 2]
      const distSq = dx * dx + dy * dy + dz * dz + softeningSq
      const invDist = 1 / Math.sqrt(distSq)
      const invDist3 = invDist * invDist * invDist // 1 / (r² + ε²)^{3/2}
      const scale = k * qi * charges[j] * invDist3
      const fx = scale * dx
      const fy = scale * dy
      const fz = scale * dz
      out[oi] += fx
      out[oi + 1] += fy
      out[oi + 2] += fz
      out[oj] -= fx
      out[oj + 1] -= fy
      out[oj + 2] -= fz
    }
  }
}
