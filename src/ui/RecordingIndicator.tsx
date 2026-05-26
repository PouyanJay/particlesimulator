import { useLifecyclePhase } from '../state/lifecycle'
import { useElapsedSeconds, formatElapsed } from './useElapsedSeconds'

/**
 * A persistent "REC" badge shown over the canvas whenever a recording is in progress — so it's
 * obvious recording is happening even after the export dialog is closed to film the simulation.
 * Reads the lifecycle phase (the single source of truth for recording state).
 */
export function RecordingIndicator() {
  const recording = useLifecyclePhase() === 'recording'
  const elapsed = useElapsedSeconds(recording)

  if (!recording) return null

  return (
    <div className="rec-indicator" role="status" aria-live="polite">
      <span className="rec-indicator__dot" aria-hidden="true" />
      <span className="rec-indicator__label">REC</span>
      <span className="rec-indicator__time">{formatElapsed(elapsed)}</span>
    </div>
  )
}
