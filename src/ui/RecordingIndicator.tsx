import { useEffect, useState } from 'react'
import { useLifecyclePhase } from '../state/lifecycle'

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * A persistent "REC" badge shown over the canvas whenever a recording is in progress — so it's
 * obvious recording is happening even after the export dialog is closed to film the simulation.
 * Reads the lifecycle phase (the single source of truth for recording state).
 */
export function RecordingIndicator() {
  const phase = useLifecyclePhase()
  const recording = phase === 'recording'
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!recording) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250)
    return () => clearInterval(id)
  }, [recording])

  if (!recording) return null

  return (
    <div className="rec-indicator" role="status" aria-live="polite">
      <span className="rec-indicator__dot" aria-hidden="true" />
      <span className="rec-indicator__label">REC</span>
      <span className="rec-indicator__time">{formatElapsed(elapsed)}</span>
    </div>
  )
}
