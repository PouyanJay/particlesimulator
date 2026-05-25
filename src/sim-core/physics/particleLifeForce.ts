/**
 * The Particle-Life interaction force (Ventrella "Clusters" / lisyarus form).
 *
 * Returns the signed force magnitude between two particles as a function of their
 * normalized separation `r = distance / interactionRadius` (so `r` runs 0→1 over the
 * interaction range). Positive = attraction, negative = repulsion.
 *
 *  - `r < beta`         universal short-range repulsion: -1 at r=0, rising linearly to 0
 *                       at r=beta (keeps particles from collapsing, independent of type).
 *  - `beta <= r < 1`    a triangular profile peaking at the type-pair coefficient `a`
 *                       (in [-1, 1]) at the midpoint r=(1+beta)/2, tapering to 0 at both
 *                       ends. `a` (which may be asymmetric per type pair) sets whether
 *                       this pair attracts or repels at mid range.
 *  - `r >= 1`           no interaction.
 *
 * @param r normalized distance (distance / interaction radius)
 * @param a type-pair attraction coefficient in [-1, 1]
 * @param beta repulsion-zone fraction in (0, 1)
 */
export function particleLifeForce(r: number, a: number, beta: number): number {
  if (r < beta) return r / beta - 1
  if (r < 1) return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta))
  return 0
}
