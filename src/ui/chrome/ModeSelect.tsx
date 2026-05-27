import { simRegistry } from '../../state/simRegistry'
import { useParamStore } from '../../state/paramStore'
import { explainerFor } from '../modeExplainers'
import { Select } from '../controls/Select'

/**
 * Switches the active simulation mode and shows a short explainer of what it demonstrates.
 * Options come straight from the registry; selecting one resets parameters to that mode's
 * defaults — so the whole flow needs no per-mode code (the SimMode plugin seam). Built on the
 * shared `Select` dropdown primitive.
 */
export function ModeSelect() {
  const modeId = useParamStore((s) => s.modeId)
  const selectMode = useParamStore((s) => s.selectMode)
  const options = simRegistry.list().map((m) => ({ value: m.id, label: m.label }))
  const explainer = explainerFor(modeId)

  return (
    <div className="mode-select">
      <span className="mode-select__label">Mode</span>
      <Select value={modeId} options={options} onChange={selectMode} ariaLabel="Simulation mode" />
      {explainer ? <p className="mode-select__about">{explainer}</p> : null}
    </div>
  )
}
