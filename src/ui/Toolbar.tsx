import { useParamStore } from '../state/paramStore'
import { Button } from './controls/Button'
import { PlayIcon, PauseIcon, ResetIcon } from './icons'

/**
 * Global run controls: play/pause and reset. Reset assigns a new seed, which re-initialises
 * the scenario with fresh initial conditions. The mode selector lives at the top of the
 * instrument sidebar (next to the parameters it governs), not here.
 */
export function Toolbar() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)

  return (
    <div className="toolbar" role="group" aria-label="Simulation controls">
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
