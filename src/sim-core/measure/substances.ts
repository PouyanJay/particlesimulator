/**
 * Real-substance mapping for the Lennard-Jones gas, via the **law of corresponding states**.
 *
 * The MD simulation runs in reduced LJ units (lengths in σ, energies in ε, mass m, k_B = 1).
 * A single reduced run therefore *is* every LJ fluid at once — you recover a specific real
 * substance just by multiplying each reduced quantity by that substance's characteristic
 * scale built from its (ε, σ, m):
 *
 *   temperature  T  = T* · (ε / k_B)        [K]
 *   energy       E  = E* · ε                [J]
 *   pressure     P  = P* · (ε / σ³)         [Pa]
 *   momentum     p  = p* · √(m·ε)           [kg·m/s]
 *   speed        v  = v* · √(ε / m)         [m/s]   (= σ/τ, τ = σ√(m/ε))
 *
 * Pure and framework-free so the conversion factors are unit-tested; the UI just multiplies
 * the reduced telemetry by `scale[...]` and labels it with `unit[...]`. The `reduced` entry is
 * the identity (factor 1, no unit) — the dimensionless default used everywhere else.
 */

const K_B = 1.380649e-23 // Boltzmann constant, J/K
const AMU = 1.66053907e-27 // atomic mass unit, kg

type Quantity = 'temperature' | 'energy' | 'pressure' | 'momentum' | 'speed'

export interface Substance {
  id: string
  label: string
  /** Factor to multiply a reduced value by to get the SI value of each quantity. */
  scale: Record<Quantity, number>
  /** SI unit label per quantity (empty string for the dimensionless `reduced` system). */
  unit: Record<Quantity, string>
}

/** Literature Lennard-Jones parameters for a substance. */
interface LjParams {
  /** Well depth as ε/k_B, in kelvin. */
  epsilonOverKb: number
  /** Collision diameter σ, in metres. */
  sigma: number
  /** Atomic mass, in unified atomic mass units (u). */
  massU: number
}

function makeSubstance(id: string, label: string, p: LjParams): Substance {
  const epsilon = p.epsilonOverKb * K_B // ε in joules
  const mass = p.massU * AMU // m in kg
  const sigma = p.sigma // σ in metres
  return {
    id,
    label,
    scale: {
      temperature: p.epsilonOverKb, // T(K) = T* · ε/k_B
      energy: epsilon, // E(J) = E* · ε
      pressure: epsilon / sigma ** 3, // P(Pa) = P* · ε/σ³
      momentum: Math.sqrt(mass * epsilon), // p = p* · √(mε)
      speed: Math.sqrt(epsilon / mass), // v = v* · √(ε/m)
    },
    unit: { temperature: 'K', energy: 'J', pressure: 'Pa', momentum: 'kg·m/s', speed: 'm/s' },
  }
}

/** The dimensionless reduced-unit system: the identity mapping, no units. */
export const REDUCED: Substance = {
  id: 'reduced',
  label: 'Reduced (dimensionless)',
  scale: { temperature: 1, energy: 1, pressure: 1, momentum: 1, speed: 1 },
  unit: { temperature: '', energy: '', pressure: '', momentum: '', speed: '' },
}

/**
 * Reduced plus the canonical noble-gas Lennard-Jones fluids (standard literature parameters).
 * Well depths increase Ne < Ar < Kr < Xe, as the polarizability does.
 */
export const SUBSTANCES: Substance[] = [
  REDUCED,
  makeSubstance('argon', 'Argon', { epsilonOverKb: 119.8, sigma: 3.405e-10, massU: 39.948 }),
  makeSubstance('neon', 'Neon', { epsilonOverKb: 36.8, sigma: 2.789e-10, massU: 20.18 }),
  makeSubstance('krypton', 'Krypton', { epsilonOverKb: 164.0, sigma: 3.633e-10, massU: 83.798 }),
  makeSubstance('xenon', 'Xenon', { epsilonOverKb: 229.0, sigma: 3.98e-10, massU: 131.293 }),
]

/** Look up a substance by id, falling back to the dimensionless reduced system. */
export function getSubstance(id: string): Substance {
  return SUBSTANCES.find((s) => s.id === id) ?? REDUCED
}
