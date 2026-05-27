import { useRef, useState } from 'react'
import { useUiStore } from '../../state/uiStore'
import { usePresetStore, type Preset } from '../../state/presetStore'
import { applyScenario } from '../../render/applyScenario'
import { currentScenario } from '../../render/currentScenario'
import { scenarioToJson, scenarioFromJson, type Scenario } from '../../sim-core/scenario'
import { downloadText } from '../../export/download'
import { timestampedFilename } from '../../export/filenames'
import { Dialog } from '../controls/Dialog'
import { TextField } from '../controls/TextField'
import { Button } from '../controls/Button'
import { DownloadIcon, TrashIcon, EditIcon } from '../icons'

/**
 * Save, restore, rename, delete, and import/export named scenarios. A preset captures the
 * full scenario (mode, params, seed, substance, view, camera) — never raw particle state.
 */
export function PresetManager() {
  const open = useUiStore((s) => s.overlay === 'presets')
  const close = useUiStore((s) => s.closeOverlay)
  const presets = usePresetStore((s) => s.presets)
  const savePreset = usePresetStore((s) => s.savePreset)
  const removePreset = usePresetStore((s) => s.removePreset)
  const renamePreset = usePresetStore((s) => s.renamePreset)

  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function handleSave(): void {
    const trimmed = name.trim()
    if (!trimmed) return
    savePreset(trimmed, currentScenario())
    setName('')
  }

  function handleLoad(preset: Preset): void {
    applyScenario(preset.scenario)
    close()
  }

  function handleExportPreset(preset: Preset): void {
    downloadText(timestampedFilename(slug(preset.name), 'json'), scenarioToJson(preset.scenario), 'application/json')
  }

  async function handleImportFile(file: File): Promise<void> {
    const text = await file.text()
    const scenario = scenarioFromJson(text)
    if (!scenario) {
      setImportError('That file is not a valid Particle Lab scenario.')
      return
    }
    setImportError(null)
    savePreset(file.name.replace(/\.json$/i, ''), scenario)
  }

  const [importError, setImportError] = useState<string | null>(null)

  return (
    <Dialog open={open} onClose={close} title="Presets" description="Save and restore complete setups.">
      <div className="preset-save">
        <TextField
          label="Save current setup as"
          value={name}
          placeholder="e.g. Dense argon at 2× temperature"
          onChange={setName}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="preset-empty">No saved presets yet. Tune the lab, then save the setup above.</p>
      ) : (
        <ul className="preset-list">
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              onLoad={() => handleLoad(preset)}
              onRename={(next) => renamePreset(preset.id, next)}
              onExport={() => handleExportPreset(preset)}
              onDelete={() => removePreset(preset.id)}
            />
          ))}
        </ul>
      )}

      {importError ? (
        <p className="preset-error" role="alert">
          {importError}
        </p>
      ) : null}

      <div className="preset-io">
        <Button onClick={() => fileInput.current?.click()}>Import file…</Button>
        <Button onClick={() => exportCurrent(currentScenario())}>Export current</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = '' // allow re-importing the same file
          }}
        />
      </div>
    </Dialog>
  )
}

function exportCurrent(scenario: Scenario): void {
  downloadText(timestampedFilename('scenario', 'json'), scenarioToJson(scenario), 'application/json')
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset'
}

function PresetRow({
  preset,
  onLoad,
  onRename,
  onExport,
  onDelete,
}: {
  preset: Preset
  onLoad: () => void
  onRename: (name: string) => void
  onExport: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(preset.name)

  function commitRename(): void {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== preset.name) onRename(trimmed)
    else setDraft(preset.name)
    setEditing(false)
  }

  return (
    <li className="preset-row">
      {editing ? (
        <input
          className="preset-row__edit"
          autoFocus
          value={draft}
          aria-label={`Rename ${preset.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setDraft(preset.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          className="preset-row__load"
          onClick={onLoad}
          aria-label={`Load ${preset.name}`}
          title="Load this preset"
        >
          <span className="preset-row__name">{preset.name}</span>
          <span className="preset-row__mode">{preset.scenario.modeId}</span>
        </button>
      )}
      <div className="preset-row__actions">
        <Button icon aria-label={`Rename ${preset.name}`} onClick={() => setEditing(true)} title="Rename">
          <EditIcon />
        </Button>
        <Button icon aria-label={`Export ${preset.name}`} onClick={onExport} title="Export as file">
          <DownloadIcon />
        </Button>
        <Button icon aria-label={`Delete ${preset.name}`} onClick={onDelete} title="Delete">
          <TrashIcon />
        </Button>
      </div>
    </li>
  )
}
