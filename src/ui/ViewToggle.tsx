import { useParamStore } from '../state/paramStore'
import type { SimView } from '../sim-core/scenario'

const OPTIONS: { value: SimView; label: string }[] = [
  { value: '3d', label: '3D' },
  { value: '2d', label: '2D' },
]

/**
 * Switches the viewport projection between the 3D orbit view and the flat orthographic 2D
 * view. A segmented control bound to the param store's `view`. The projection is part of the
 * scenario, so it's shared, persisted, and undoable like any other setting.
 */
export function ViewToggle() {
  const view = useParamStore((s) => s.view)
  const setView = useParamStore((s) => s.setView)

  return (
    <div className="view-toggle" role="group" aria-label="Projection">
      <span className="view-toggle__label">View</span>
      <div className="segmented">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segmented__option${view === option.value ? ' is-active' : ''}`}
            aria-pressed={view === option.value}
            onClick={() => setView(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
