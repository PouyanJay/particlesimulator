import { useParamStore } from '../../state/paramStore'
import { nextRovingIndex } from '../controls/roving'
import type { SimView } from '../../sim-core/scenario'

const OPTIONS: { value: SimView; label: string }[] = [
  { value: '3d', label: '3D' },
  { value: '2d', label: '2D' },
]

/**
 * Switches the viewport projection between the 3D orbit view and the flat orthographic 2D
 * view. A single-select radiogroup (not independent toggles) so it's announced as one
 * mutually-exclusive choice, with roving tab focus + arrow-key navigation. Bound to the param
 * store's `view`, which is part of the scenario — shared, persisted, and undoable.
 */
export function ViewToggle() {
  const view = useParamStore((s) => s.view)
  const setView = useParamStore((s) => s.setView)
  const activeIndex = OPTIONS.findIndex((o) => o.value === view)

  function onKeyDown(e: React.KeyboardEvent): void {
    const next = nextRovingIndex(e.key, activeIndex, OPTIONS.length, 'both')
    if (next === null) return
    e.preventDefault()
    setView(OPTIONS[next].value)
  }

  return (
    <div className="view-toggle">
      <span className="view-toggle__label" id="view-toggle-label">
        View
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby="view-toggle-label" onKeyDown={onKeyDown}>
        {OPTIONS.map((option) => {
          const checked = view === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={`segmented__option${checked ? ' is-active' : ''}`}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
