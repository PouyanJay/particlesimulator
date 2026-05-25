import { useParamStore } from '../state/paramStore'
import { Button } from './controls/Button'

/**
 * Global simulation controls: play/pause and reset. Reset assigns a new seed, which
 * re-initialises the scenario with fresh initial conditions via the render layer.
 */
export function Toolbar() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)

  return (
    <div className="toolbar" role="group" aria-label="Simulation controls">
      <Button variant="primary" onClick={togglePlaying} aria-pressed={isPlaying}>
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Button onClick={randomizeSeed}>Reset</Button>
    </div>
  )
}
