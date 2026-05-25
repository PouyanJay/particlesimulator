/**
 * Lennard-Jones pair interaction — the force kernel that defines the molecular-dynamics
 * gas. Pure, framework-free, and exhaustively unit-tested so the MD mode can rely on it.
 *
 *   Potential:  V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]
 *   Force:      F(r) = (24ε/r)[2(σ/r)¹² − (σ/r)⁶]   (sign: + = repulsive, pushing apart)
 *
 * The potential has its minimum (V = −ε) at r = 2^(1/6)·σ, which is where the raw force
 * changes sign: repulsive (F > 0) below it, attractive (F < 0) above it up to the cutoff.
 *
 * Cutoff & force-shifting
 * -----------------------
 * Beyond a cutoff radius r_c (default 2.5σ) the interaction is truncated to keep the
 * neighbour cost O(N). A *plain* truncation leaves a discontinuity: F(r_c⁻) ≠ 0, so an
 * atom crossing the cutoff feels an impulsive kick and energy is silently injected. We
 * therefore use the **force-shifted** form — subtract the constant F_raw(r_c) from the
 * force so it goes continuously to zero at r_c:
 *
 *   F_shift(r) = F_raw(r) − F_raw(r_c)   for r < r_c,   else 0
 *
 * This is the standard well-behaved-energy choice for MD with a hard cutoff. The matching
 * shifted potential (used only by tests/diagnostics) adds the linear ramp (r − r_c)·F_raw(r_c).
 */

/** Raw (un-shifted) LJ force magnitude along the separation; + = repulsive. */
function rawForce(r: number, epsilon: number, sigma: number): number {
  const sr6 = (sigma / r) ** 6
  return (24 * epsilon / r) * (2 * sr6 * sr6 - sr6)
}

/**
 * Force-shifted Lennard-Jones force magnitude at separation `r`.
 *
 * Returns the scalar force along the unit separation vector (positive = the two atoms
 * push apart). Exactly zero at and beyond `cutoff` so the force is continuous there.
 *
 * @param r       centre-to-centre distance (> 0)
 * @param epsilon well depth ε (energy scale)
 * @param sigma   length scale σ (V = 0 at r = σ)
 * @param cutoff  cutoff radius r_c in the same length units as r and σ
 */
export function lennardJonesForce(r: number, epsilon: number, sigma: number, cutoff: number): number {
  if (r >= cutoff) return 0
  return rawForce(r, epsilon, sigma) - rawForce(cutoff, epsilon, sigma)
}

/**
 * Bare (un-truncated) Lennard-Jones potential energy at separation `r`. Used by tests and
 * energy diagnostics; the running simulation only needs the force kernel above.
 */
export function lennardJonesPotential(r: number, epsilon: number, sigma: number): number {
  const sr6 = (sigma / r) ** 6
  return 4 * epsilon * (sr6 * sr6 - sr6)
}
