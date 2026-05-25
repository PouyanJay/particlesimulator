/**
 * All-pairs Newtonian gravity accelerations (equal unit masses).
 *
 * For each body i: a_i = G · Σ_{j≠i} (p_j − p_i) / (|p_j − p_i|² + ε²)^{3/2}, computed
 * with the i<j symmetry so each pair is evaluated once and contributes equal-and-opposite
 * forces (total momentum is conserved). The softening ε² removes the 1/r² singularity at
 * close range, keeping the integration stable through near-encounters.
 *
 * O(N²) — fine for the CPU tier (a few thousand bodies); Barnes-Hut / GPU come later.
 *
 * @param positions xyz-interleaved, length 3·count
 * @param count number of bodies
 * @param g gravitational constant
 * @param softeningSq ε² (softening length squared)
 * @param out xyz-interleaved accelerations, length 3·count (overwritten)
 */
export function computeGravityAccelerations(
  positions: Readonly<Float64Array>,
  count: number,
  g: number,
  softeningSq: number,
  out: Float64Array,
): void {
  out.fill(0)
  for (let i = 0; i < count; i++) {
    const oi = i * 3
    for (let j = i + 1; j < count; j++) {
      const oj = j * 3
      const dx = positions[oj] - positions[oi]
      const dy = positions[oj + 1] - positions[oi + 1]
      const dz = positions[oj + 2] - positions[oi + 2]
      const distSq = dx * dx + dy * dy + dz * dz + softeningSq
      const invDist = 1 / Math.sqrt(distSq)
      const invDist3 = invDist * invDist * invDist // 1 / (r² + ε²)^{3/2}
      const fx = g * dx * invDist3
      const fy = g * dy * invDist3
      const fz = g * dz * invDist3
      out[oi] += fx
      out[oi + 1] += fy
      out[oi + 2] += fz
      out[oj] -= fx
      out[oj + 1] -= fy
      out[oj + 2] -= fz
    }
  }
}
