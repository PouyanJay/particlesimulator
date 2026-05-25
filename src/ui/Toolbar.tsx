import { useParamStore } from '../state/paramStore'
import { Button } from './controls/Button'
import { ModeSelect } from './ModeSelect'
import { PlayIcon, PauseIcon, ResetIcon } from './icons'

/**
 * Global simulation controls: mode selector, play/pause, and reset. Reset assigns a new
 * seed, which re-initialises the scenario with fresh initial conditions.
 */
export function Toolbar() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)

  return (
    <div className="toolbar" role="group" aria-label="Simulation controls">
      <ModeSelect />
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
