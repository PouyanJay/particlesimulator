import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { ChevronDownIcon } from './icons'

/**
 * Switches the active simulation mode. Options come straight from the registry, and
 * selecting one resets parameters to that mode's defaults — so the whole mode-switch
 * flow needs no per-mode code here (the SimMode plugin seam).
 */
export function ModeSelect() {
  const modeId = useParamStore((s) => s.modeId)
  const selectMode = useParamStore((s) => s.selectMode)
  const modes = simRegistry.list()

  return (
    <label className="mode-select">
      <span className="mode-select__label">Mode</span>
      <span className="select-wrap">
        <select
          className="select"
          value={modeId}
          onChange={(e) => selectMode(e.target.value)}
          aria-label="Simulation mode"
        >
          {modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="select-chevron" />
      </span>
    </label>
  )
}
