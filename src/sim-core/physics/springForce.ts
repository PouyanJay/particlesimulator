/**
 * Damped linear (Hooke) spring forces over an edge list — the force kernel that defines the
 * spring-mass mode. Pure, framework-free, and exhaustively unit-tested so the mode can rely
 * on it (mirrors `coulomb.ts` / `lennardJonesForce.ts`).
 *
 * For a spring connecting nodes i and j (rest length L₀, stiffness k, damping c):
 *
 *   d = x_i − x_j      (separation, points from j toward i)
 *   r = |d|,  û = d/r  (current length, unit axis)
 *   F_scalar = −k·(r − L₀)            (Hooke: restoring; − when stretched, + when compressed)
 *            − c·((v_i − v_j) · û)    (damping: opposes motion *along* the axis only)
 *   F_i = F_scalar · û,   F_j = −F_i  (equal and opposite — Newton's 3rd law)
 *
 * Damping is projected onto the spring axis, so pure shearing (transverse) motion is not
 * damped — only stretching/compressing is. Forces are accumulated, so a node shared by many
 * springs (the interior of a cloth or lattice) sums every contribution.
 *
 * Unit mass is assumed by the caller (a = F/m, m = 1), matching the other CPU kernels.
 *
 * @param positions   xyz-interleaved node positions, length 3·count
 * @param velocities  xyz-interleaved node velocities, length 3·count
 * @param edges       node-index pairs (i, j), length 2·edgeCount
 * @param restLengths per-edge rest length L₀, length edgeCount
 * @param stiffness   spring constant k (≥ 0)
 * @param damping     axial damping coefficient c (≥ 0)
 * @param out         xyz-interleaved forces, length 3·nodeCount (overwritten/zeroed first)
 */
export function accumulateSpringForces(
  positions: Readonly<Float64Array>,
  velocities: Readonly<Float64Array>,
  edges: Readonly<Uint32Array>,
  restLengths: Readonly<Float64Array>,
  stiffness: number,
  damping: number,
  out: Float64Array,
): void {
  out.fill(0)
  const edgeCount = edges.length >> 1
  for (let e = 0; e < edgeCount; e++) {
    const i = edges[e * 2]
    const j = edges[e * 2 + 1]
    const oi = i * 3
    const oj = j * 3

    const dx = positions[oi] - positions[oj]
    const dy = positions[oi + 1] - positions[oj + 1]
    const dz = positions[oi + 2] - positions[oj + 2]
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
    // A fully collapsed spring has no defined axis; skip it rather than divide by zero.
    if (r < 1e-12) continue

    const invR = 1 / r
    const ux = dx * invR
    const uy = dy * invR
    const uz = dz * invR

    // Hooke restoring term (negative along û when stretched, pulling the nodes together).
    const elastic = -stiffness * (r - restLengths[e])

    // Axial damping: project the relative velocity onto û and oppose only that component.
    const rvx = velocities[oi] - velocities[oj]
    const rvy = velocities[oi + 1] - velocities[oj + 1]
    const rvz = velocities[oi + 2] - velocities[oj + 2]
    const axialVel = rvx * ux + rvy * uy + rvz * uz
    const damped = -damping * axialVel

    const scale = elastic + damped
    const fx = scale * ux
    const fy = scale * uy
    const fz = scale * uz

    out[oi] += fx
    out[oi + 1] += fy
    out[oi + 2] += fz
    out[oj] -= fx
    out[oj + 1] -= fy
    out[oj + 2] -= fz
  }
}
