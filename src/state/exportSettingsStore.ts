import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { clientStorage } from './clientStorage'
import { DEFAULT_RECORD_FORMAT, type RecordFormat } from '../export/recordFormats'

interface ExportSettingsState {
  /** Video format used by the one-tap record button and pre-selected in the export dialog. */
  recordFormat: RecordFormat
  setRecordFormat: (format: RecordFormat) => void
}

/**
 * Persisted capture preferences. The video format behaves like a setting — pick MP4 once and it
 * stays MP4 across sessions — so the quick-record button can start immediately with no dialog.
 */
export const useExportSettingsStore = create<ExportSettingsState>()(
  persist(
    (set) => ({
      recordFormat: DEFAULT_RECORD_FORMAT,
      setRecordFormat: (recordFormat) => set({ recordFormat }),
    }),
    {
      name: 'particle-lab:export-settings',
      version: 1,
      storage: createJSONStorage(() => clientStorage),
    },
  ),
)
