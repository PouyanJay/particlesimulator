/**
 * Smoothing kernels for Smoothed-Particle Hydrodynamics (the standard Müller-2003 set, in 3-D).
 * Pure, framework-free, exhaustively unit-tested so the SPH field/mode can rely on them.
 *
 * Each kernel W(r, h) has compact support: it is zero at and beyond the smoothing radius `h`,
 * and each is normalised so ∫ W dV = 1 over the sphere of radius h. Three kernels, each chosen
 * for the quantity it estimates:
 *   - **poly6** — density summation. Smooth and finite at r = 0 (so an isolated particle still
 *     has a well-defined self-density), which makes it the standard choice for ρ = Σ m·W.
 *   - **spiky gradient** — the pressure force. Its gradient is non-zero and steepest as r → 0,
 *     giving the short-range repulsion that keeps particles from clumping (poly6's gradient
 *     vanishes at the centre, which would let particles collapse together).
 *   - **viscosity Laplacian** — the viscosity force. Its Laplacian is positive everywhere in the
 *     support, so the diffusion term never injects energy.
 *
 * References: Müller, Charypar & Gross, "Particle-Based Fluid Simulation for Interactive
 * Applications" (2003).
 */

/**
 * poly6 density kernel: W(r,h) = 315/(64π h⁹) · (h² − r²)³ for 0 ≤ r ≤ h, else 0.
 * Maximal at r = 0, smoothly zero at r = h.
 */
export function poly6(r: number, h: number): number {
  if (r >= h) return 0
  const hSq = h * h
  const diff = hSq - r * r
  return (315 / (64 * Math.PI * h ** 9)) * diff * diff * diff
}

/**
 * Scalar coefficient of the spiky kernel's gradient, dW/dr = −45/(π h⁶)·(h − r)², for r < h
 * (else 0). Negative inside the support (the kernel falls off with distance) and steepest near
 * the centre. The gradient vector is this coefficient times the unit separation r̂ = (xᵢ−xⱼ)/r;
 * a positive pressure then yields a repulsive force (see `sphField`).
 */
export function spikyGradientCoefficient(r: number, h: number): number {
  if (r >= h) return 0
  const diff = h - r
  return -(45 / (Math.PI * h ** 6)) * diff * diff
}

/**
 * Laplacian of the viscosity kernel: ∇²W(r,h) = 45/(π h⁶)·(h − r) for 0 ≤ r ≤ h, else 0.
 * Non-negative across the support, so the viscosity term only ever damps relative motion.
 */
export function viscosityLaplacian(r: number, h: number): number {
  if (r >= h) return 0
  return (45 / (Math.PI * h ** 6)) * (h - r)
}
