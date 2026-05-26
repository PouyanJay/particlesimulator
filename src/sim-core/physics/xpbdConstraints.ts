/**
 * XPBD (Extended Position-Based Dynamics) constraint projection — the position-level solver
 * that defines the cloth / soft-body mode, the counterpart to the force kernel in
 * `springForce.ts`. Where a spring applies a *force* and lets an integrator move the masses
 * (and can explode at high stiffness / large dt), XPBD instead **projects positions** so the
 * constraint is (softly) satisfied directly — which is unconditionally stable regardless of
 * stiffness or timestep. Pure, framework-free, exhaustively unit-tested.
 *
 * Distance constraint between nodes i and j (rest length L₀):
 *
 *   C(x)   = |xᵢ − xⱼ| − L₀                         (0 ⇒ satisfied)
 *   ∇Cᵢ    = n̂ = (xᵢ − xⱼ)/|xᵢ − xⱼ|,   ∇Cⱼ = −n̂
 *   α̃      = compliance / dt²                        (compliance 0 ⇒ rigid)
 *   Δλ     = (−C − α̃·λ) / (wᵢ + wⱼ + α̃)             (w = inverse mass; pinned ⇒ w = 0)
 *   Δxᵢ    = +wᵢ · n̂ · Δλ,   Δxⱼ = −wⱼ · n̂ · Δλ      (λ += Δλ)
 *
 * The inverse-mass weighting makes corrections momentum-preserving (Σ mᵢ·Δxᵢ = 0) and pins
 * nodes for free (w = 0 ⇒ no movement). `compliance` is the inverse stiffness (units length/force);
 * dividing by dt² is what makes the resulting stiffness independent of the timestep — the
 * defining property of XPBD over plain PBD.
 *
 * This performs one Gauss–Seidel sweep over all edges, mutating `positions` and accumulating
 * the per-edge Lagrange multipliers `lambdas` in place. The caller resets `lambdas` to 0 at the
 * start of each substep and may sweep multiple iterations (more iterations ⇒ stiffer/converged).
 *
 * @param positions   xyz-interleaved node positions, length 3·nodeCount (mutated)
 * @param invMass     per-node inverse mass (1/m; 0 = pinned/immovable), length nodeCount
 * @param edges       node-index pairs (i, j), length 2·edgeCount
 * @param restLengths per-edge rest length L₀, length edgeCount
 * @param lambdas     per-edge Lagrange multipliers, length edgeCount (mutated/accumulated)
 * @param compliance  inverse stiffness α (≥ 0; 0 = rigid)
 * @param dtSq        substep dt², squared (> 0)
 */
export function solveDistanceConstraints(
  positions: Float64Array,
  invMass: Readonly<Float64Array>,
  edges: Readonly<Uint32Array>,
  restLengths: Readonly<Float64Array>,
  lambdas: Float64Array,
  compliance: number,
  dtSq: number,
): void {
  const alphaTilde = compliance / dtSq
  const edgeCount = edges.length >> 1
  for (let e = 0; e < edgeCount; e++) {
    const i = edges[e * 2]
    const j = edges[e * 2 + 1]
    const wi = invMass[i]
    const wj = invMass[j]
    const wSum = wi + wj
    if (wSum === 0) continue // both endpoints pinned ⇒ nothing to move

    const oi = i * 3
    const oj = j * 3
    const dx = positions[oi] - positions[oj]
    const dy = positions[oi + 1] - positions[oj + 1]
    const dz = positions[oi + 2] - positions[oj + 2]
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (len < 1e-12) continue // collapsed: no defined constraint direction

    const constraint = len - restLengths[e]
    const dLambda = (-constraint - alphaTilde * lambdas[e]) / (wSum + alphaTilde)
    lambdas[e] += dLambda

    const invLen = 1 / len
    const sx = dx * invLen * dLambda
    const sy = dy * invLen * dLambda
    const sz = dz * invLen * dLambda
    positions[oi] += wi * sx
    positions[oi + 1] += wi * sy
    positions[oi + 2] += wi * sz
    positions[oj] -= wj * sx
    positions[oj + 1] -= wj * sy
    positions[oj + 2] -= wj * sz
  }
}
