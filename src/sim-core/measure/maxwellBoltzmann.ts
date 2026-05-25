/**
 * The analytic 3-D Maxwell–Boltzmann speed distribution, parameterised by the
 * mean-square speed `<v²> = 3kT/m` (so it can be evaluated straight from measured
 * telemetry without needing temperature or mass explicitly).
 *
 *   f(v) = sqrt(2/π) · v²/a³ · exp(−v²/2a²),   where a² = kT/m = <v²>/3
 *
 * This normalised PDF peaks at the most-probable speed v_p = √(2a²) = √(2/3·<v²>).
 * Overlaying it on the live speed histogram of a thermalised gas is the lab's
 * "theory emerges from the simulation" demonstration.
 */
export function maxwellBoltzmannPdf(speed: number, meanSquareSpeed: number): number {
  if (meanSquareSpeed <= 0 || speed <= 0) return 0
  const aSq = meanSquareSpeed / 3 // a² = kT/m
  const a = Math.sqrt(aSq)
  return (Math.sqrt(2 / Math.PI) * (speed * speed)) / (a * a * a) * Math.exp(-(speed * speed) / (2 * aSq))
}

/** Most-probable speed (the peak of the distribution) for a given mean-square speed. */
export function mostProbableSpeed(meanSquareSpeed: number): number {
  return Math.sqrt((2 / 3) * Math.max(0, meanSquareSpeed))
}
