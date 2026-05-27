import { useParamStore } from '../../state/paramStore'
import { SUBSTANCES } from '../../sim-core/measure/substances'
import { Select } from '../controls/Select'

/**
 * Chooses how the Lennard-Jones gas readouts are displayed: the dimensionless reduced system
 * (default) or a real noble gas, which maps the reduced values to SI via the law of
 * corresponding states (see `substances`). Only meaningful for the LJ gas — the caller renders
 * it only for that mode. Built on the shared `Select` dropdown primitive.
 */
export function UnitsSelect() {
  const substanceId = useParamStore((s) => s.substanceId)
  const setSubstance = useParamStore((s) => s.setSubstance)
  const options = SUBSTANCES.map((s) => ({ value: s.id, label: s.label }))

  return (
    <div className="units-select">
      <span className="units-select__label">Display units</span>
      <Select value={substanceId} options={options} onChange={setSubstance} ariaLabel="Display units" />
    </div>
  )
}
