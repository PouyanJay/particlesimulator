import { useCallback, useState } from 'react'
import { useLifecyclePhase } from '../../state/lifecycle'
import { useExportSettingsStore } from '../../state/exportSettingsStore'
import { beginRecording, endRecording } from '../../export/recordingController'
import type { RecordFormat } from '../../export/recordFormats'

export interface RecordToggle {
  /** True while a recording is in progress. */
  recording: boolean
  /** The persisted video format a new recording will use. */
  format: RecordFormat
  /** Last start/stop error, or null. */
  error: string | null
  /** Start (using the persisted format) or stop the recording. */
  toggle: () => Promise<void>
}

/**
 * One source of recording start/stop, shared by the toolbar's quick-record button and the export
 * dialog. Starting uses the persisted video format (no dialog needed), so a single tap begins a
 * clean start→stop capture. begin/endRecording are idempotent, so rapid taps are safe.
 */
export function useRecordToggle(): RecordToggle {
  const recording = useLifecyclePhase() === 'recording'
  const format = useExportSettingsStore((s) => s.recordFormat)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    setError(null)
    try {
      if (recording) await endRecording()
      else await beginRecording(format)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed')
    }
  }, [recording, format])

  return { recording, format, error, toggle }
}
