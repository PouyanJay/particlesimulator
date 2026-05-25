import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { Select } from './controls/Select'

/**
 * Switches the active simulation mode. Options come straight from the registry; selecting one
 * resets parameters to that mode's defaults — so the whole flow needs no per-mode code (the
 * SimMode plugin seam). Built on the shared `Select` dropdown primitive.
 */
export function ModeSelect() {
  const modeId = useParamStore((s) => s.modeId)
  const selectMode = useParamStore((s) => s.selectMode)
  const options = simRegistry.list().map((m) => ({ value: m.id, label: m.label }))

  return (
    <div className="mode-select">
      <span className="mode-select__label">Mode</span>
      <Select value={modeId} options={options} onChange={selectMode} ariaLabel="Simulation mode" />
    </div>
  )
}
