import { useParamStore } from '../state/paramStore'
import { getSubstance, type Substance } from '../sim-core/measure/substances'

/** Only the Lennard-Jones gas has a rigorous real-substance mapping (it is an LJ fluid). */
const SUBSTANCE_MODE = 'molecular-dynamics'

/**
 * The active display unit system and whether to show dimensional (SI) values. Readouts are
 * dimensional only on the LJ gas with a real substance selected; every other case stays in
 * the dimensionless reduced units.
 */
export function useReadoutUnits(): { substance: Substance; dimensional: boolean } {
  const modeId = useParamStore((s) => s.modeId)
  const substanceId = useParamStore((s) => s.substanceId)
  const substance = getSubstance(substanceId)
  return { substance, dimensional: modeId === SUBSTANCE_MODE && substance.id !== 'reduced' }
}

/**
 * Format an SI value for display: fixed notation for human-scale magnitudes, exponential for
 * the very small / very large numbers that atomic-scale SI produces (e.g. ~1e-19 J energies).
 */
export function formatSi(x: number): string {
  if (x === 0) return '0'
  const magnitude = Math.abs(x)
  if (magnitude < 1e-3 || magnitude >= 1e5) return x.toExponential(2)
  if (magnitude >= 100) return x.toFixed(1)
  return x.toPrecision(4)
}
