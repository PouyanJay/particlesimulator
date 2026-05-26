import { useUiStore } from '../state/uiStore'
import { simRegistry } from '../state/simRegistry'
import { applyScenario } from '../render/applyScenario'
import { allCuratedScenarios } from '../sim-core/scenarios/curated'
import { Dialog } from './controls/Dialog'

/** Mode label for a mode id (falls back to the id if somehow unregistered). */
function modeLabel(modeId: string): string {
  return simRegistry.list().find((m) => m.id === modeId)?.label ?? modeId
}

/** A gallery of hand-tuned showcase setups; selecting one loads it and starts running. */
export function ScenariosDialog() {
  const open = useUiStore((s) => s.overlay === 'scenarios')
  const close = useUiStore((s) => s.closeOverlay)

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Curated scenarios"
      description="Jump straight into a hand-tuned demonstration."
    >
      <div className="cards">
        {allCuratedScenarios.map((curated) => (
          <button
            key={curated.id}
            className="card"
            onClick={() => {
              applyScenario(curated.scenario)
              close()
            }}
          >
            <span className="card__title">{curated.title}</span>
            <span className="card__summary">{curated.summary}</span>
            <span className="card__meta">{modeLabel(curated.scenario.modeId)}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
