import { describe, it, expect, beforeEach } from 'vitest'
import { useExportSettingsStore } from './exportSettingsStore'
import { clientStorage } from './clientStorage'
import { DEFAULT_RECORD_FORMAT } from '../export/recordFormats'

beforeEach(() => useExportSettingsStore.setState({ recordFormat: DEFAULT_RECORD_FORMAT }))

describe('exportSettingsStore', () => {
  it('defaults to the safe default record format', () => {
    expect(useExportSettingsStore.getState().recordFormat).toBe(DEFAULT_RECORD_FORMAT)
  })

  it('updates the chosen video format', () => {
    useExportSettingsStore.getState().setRecordFormat('mp4')
    expect(useExportSettingsStore.getState().recordFormat).toBe('mp4')
  })

  it('persists the chosen format so it survives a reload', () => {
    useExportSettingsStore.getState().setRecordFormat('mp4')
    const raw = clientStorage.getItem('particle-lab:export-settings')
    expect(typeof raw === 'string' ? raw : '').toContain('mp4')
  })
})
