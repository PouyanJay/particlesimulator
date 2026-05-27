import { useParamStore } from '../../state/paramStore'
import { useParamHistory } from '../../state/useParamHistory'
import { useRecordToggle } from '../hooks/useRecordToggle'
import { Button } from '../controls/Button'
import { PlayIcon, PauseIcon, ResetIcon, UndoIcon, RedoIcon, RecordIcon, StopIcon } from '../icons'
import { MOD, SHIFT_MOD } from '../platform'

/**
 * Global run controls: undo/redo, play/pause, one-tap record/stop, and reset. Record starts
 * immediately using the persisted video format (no dialog); the format is chosen in the export
 * dialog. Reset assigns a new seed, re-initialising the scenario with fresh initial conditions.
 * The mode selector lives at the top of the instrument sidebar, not here.
 */
export function Toolbar() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)
  const { undo, redo, canUndo, canRedo } = useParamHistory()
  const { recording, format, toggle } = useRecordToggle()

  return (
    <div className="toolbar" role="group" aria-label="Simulation controls">
      <Button icon onClick={() => undo()} disabled={!canUndo} aria-label="Undo" title={`Undo (${MOD}Z)`}>
        <UndoIcon />
      </Button>
      <Button icon onClick={() => redo()} disabled={!canRedo} aria-label="Redo" title={`Redo (${SHIFT_MOD}Z)`}>
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
      <Button
        icon
        className="toolbar__record"
        onClick={() => void toggle()}
        aria-pressed={recording}
        aria-label={recording ? 'Stop recording' : `Start recording (${format.toUpperCase()})`}
        title={recording ? 'Stop recording' : `Record (${format.toUpperCase()})`}
      >
        {recording ? <StopIcon /> : <RecordIcon />}
      </Button>
      <Button onClick={randomizeSeed} title="Reset with new initial conditions">
        <ResetIcon />
        Reset
      </Button>
    </div>
  )
}
