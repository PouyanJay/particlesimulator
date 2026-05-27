import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../../state/uiStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useExportSettingsStore } from '../../state/exportSettingsStore'
import { getCanvas } from '../../render/canvasBridge'
import { currentScenario } from '../../render/currentScenario'
import { telemetryToCsv, telemetryToJson } from '../../export/telemetrySerialize'
import { downloadText, triggerDownload } from '../../export/download'
import { timestampedFilename } from '../../export/filenames'
import { captureCanvasPng } from '../../export/screenshot'
import { RECORD_FORMATS, type RecordFormat } from '../../export/recordFormats'
import { scenarioToJson } from '../../sim-core/scenario'
import { useRecordToggle } from '../hooks/useRecordToggle'
import { useElapsedSeconds, formatElapsed } from '../hooks/useElapsedSeconds'
import { Dialog } from '../controls/Dialog'
import { Tabs } from '../controls/Tabs'
import { Button } from '../controls/Button'
import { ButtonGroup } from '../controls/ButtonGroup'
import { Select } from '../controls/Select'

/**
 * Capture and export: record the canvas to MP4/WebM/GIF, grab a PNG screenshot, and export
 * measured telemetry (CSV/JSON) and the scenario (JSON). Recording is frame-stepped from the
 * render loop (see RecorderStepper); this dialog only starts/stops it.
 */
export function ExportDialog() {
  const open = useUiStore((s) => s.overlay === 'export')
  const close = useUiStore((s) => s.closeOverlay)
  const [tab, setTab] = useState('capture')

  return (
    <Dialog open={open} onClose={close} title="Export & record">
      <Tabs
        ariaLabel="Export options"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'capture', label: 'Capture', content: <CapturePanel /> },
          { id: 'data', label: 'Data', content: <DataPanel /> },
        ]}
      />
    </Dialog>
  )
}

function CapturePanel() {
  const { recording, toggle, error: recordError } = useRecordToggle()
  const format = useExportSettingsStore((s) => s.recordFormat)
  const setFormat = useExportSettingsStore((s) => s.setRecordFormat)
  const elapsed = useElapsedSeconds(recording)
  const [shotError, setShotError] = useState<string | null>(null)
  const error = recordError ?? shotError

  async function screenshot(): Promise<void> {
    setShotError(null)
    const canvas = getCanvas()
    if (!canvas) {
      setShotError('The canvas is not ready yet.')
      return
    }
    const blob = await captureCanvasPng(canvas)
    if (blob) triggerDownload(timestampedFilename('particle-lab', 'png'), blob)
    else setShotError('Could not capture the canvas.')
  }

  return (
    <div className="export-panel">
      <div className="export-row">
        <span className="export-row__label">Video format</span>
        <Select
          ariaLabel="Video format"
          value={format}
          options={RECORD_FORMATS.map((f) => ({ value: f.format, label: f.label }))}
          onChange={(v) => setFormat(v as RecordFormat)}
        />
      </div>
      <ButtonGroup>
        <Button variant={recording ? 'ghost' : 'primary'} onClick={() => void toggle()}>
          {recording ? 'Stop recording' : 'Start recording'}
        </Button>
        <Button onClick={() => void screenshot()} disabled={recording}>
          Screenshot (PNG)
        </Button>
      </ButtonGroup>
      {recording ? (
        <div className="export-recording" role="status" aria-live="polite">
          <span className="rec-indicator__dot" aria-hidden="true" />
          <span className="export-recording__label">Recording</span>
          <span className="rec-indicator__time">{formatElapsed(elapsed)}</span>
        </div>
      ) : (
        <p className="export-hint">
          Records the live canvas. MP4 falls back to WebM if your browser can’t encode it.
        </p>
      )}
      {error ? (
        <p className="export-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function DataPanel() {
  const series = useTelemetryStore(
    useShallow((s) => ({ speedHistory: s.speedHistory, energyHistory: s.energyHistory })),
  )
  const current = useTelemetryStore((s) => s.current)
  const hasData = series.speedHistory.length > 0 || series.energyHistory.length > 0

  return (
    <div className="export-panel">
      <ButtonGroup>
        <Button
          disabled={!hasData}
          onClick={() => downloadText(timestampedFilename('telemetry', 'csv'), telemetryToCsv(series), 'text/csv;charset=utf-8')}
        >
          Telemetry CSV
        </Button>
        <Button
          disabled={!hasData}
          onClick={() =>
            downloadText(timestampedFilename('telemetry', 'json'), telemetryToJson(series, current), 'application/json')
          }
        >
          Telemetry JSON
        </Button>
        <Button
          onClick={() =>
            downloadText(timestampedFilename('scenario', 'json'), scenarioToJson(currentScenario()), 'application/json')
          }
        >
          Scenario JSON
        </Button>
      </ButtonGroup>
      {!hasData ? <p className="export-hint">Run the simulation to collect telemetry to export.</p> : null}
    </div>
  )
}
