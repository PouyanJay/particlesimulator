import { useParamStore } from '../state/paramStore'
import { useParamHistory } from '../state/useParamHistory'
import { Button } from './controls/Button'
import { PlayIcon, PauseIcon, ResetIcon, UndoIcon, RedoIcon } from './icons'

/**
 * Global run controls: undo/redo, play/pause, and reset. Reset assigns a new seed, which
 * re-initialises the scenario with fresh initial conditions. The mode selector lives at the
 * top of the instrument sidebar (next to the parameters it governs), not here.
 */
export function Toolbar() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)
  const { undo, redo, canUndo, canRedo } = useParamHistory()

  return (
    <div className="toolbar" role="group" aria-label="Simulation controls">
      <Button
        icon
        onClick={() => undo()}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (⌘Z)"
      >
        <UndoIcon />
      </Button>
      <Button
        icon
        onClick={() => redo()}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (⇧⌘Z)"
      >
        <RedoIcon />
      </Button>
      <Button
        variant="primary"
        icon
        onClick={togglePlaying}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button onClick={randomizeSeed} title="Reset with new initial conditions">
        <ResetIcon />
        Reset
      </Button>
    </div>
  )
}
