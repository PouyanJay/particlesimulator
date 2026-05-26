import { useState } from 'react'
import { useUiStore } from '../state/uiStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { useLifecyclePhase } from '../state/lifecycle'
import { getCanvas } from '../render/canvasBridge'
import { currentScenario } from '../render/currentScenario'
import { telemetryToCsv, telemetryToJson } from '../export/telemetrySerialize'
import { downloadText, triggerDownload } from '../export/download'
import { timestampedFilename } from '../export/filenames'
import { captureCanvasPng } from '../export/screenshot'
import { beginRecording, endRecording } from '../export/recordingController'
import { RECORD_FORMATS, DEFAULT_RECORD_FORMAT, type RecordFormat } from '../export/recordFormats'
import { scenarioToJson } from '../sim-core/scenario'
import { Dialog } from './controls/Dialog'
import { Tabs } from './controls/Tabs'
import { Button } from './controls/Button'
import { Select } from './controls/Select'

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
  const phase = useLifecyclePhase()
  const recording = phase === 'recording'
  const [format, setFormat] = useState<RecordFormat>(DEFAULT_RECORD_FORMAT)
  const [error, setError] = useState<string | null>(null)

  async function toggleRecording(): Promise<void> {
    setError(null)
    try {
      if (recording) await endRecording()
      else await beginRecording(format)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed')
    }
  }

  async function screenshot(): Promise<void> {
    setError(null)
    const canvas = getCanvas()
    if (!canvas) {
      setError('The canvas is not ready yet.')
      return
    }
    const blob = await captureCanvasPng(canvas)
    if (blob) triggerDownload(timestampedFilename('particle-lab', 'png'), blob)
    else setError('Could not capture the canvas.')
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
      <div className="export-actions">
        <Button variant={recording ? 'ghost' : 'primary'} onClick={() => void toggleRecording()}>
          {recording ? 'Stop recording' : 'Start recording'}
        </Button>
        <Button onClick={() => void screenshot()} disabled={recording}>
          Screenshot (PNG)
        </Button>
      </div>
      {recording ? (
        <p className="export-hint" role="status">
          Recording… the file downloads when you stop.
        </p>
      ) : (
        <p className="export-hint">Records the live canvas frame-by-frame. Stop to save the file.</p>
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
  const series = useTelemetryStore((s) => ({ speedHistory: s.speedHistory, energyHistory: s.energyHistory }))
  const current = useTelemetryStore((s) => s.current)
  const hasData = series.speedHistory.length > 0 || series.energyHistory.length > 0

  return (
    <div className="export-panel">
      <div className="export-actions">
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
      </div>
      {!hasData ? <p className="export-hint">Run the simulation to collect telemetry to export.</p> : null}
    </div>
  )
}
