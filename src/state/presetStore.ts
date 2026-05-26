import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Scenario } from '../sim-core/scenario'
import { clientStorage } from './clientStorage'

/** A user-saved, named scenario. Persisted to localStorage, independent of the live params. */
export interface Preset {
  id: string
  name: string
  scenario: Scenario
  createdAt: number
}

interface PresetState {
  presets: Preset[]
  /** Save the given scenario under a name; returns the created preset (newest-first). */
  savePreset: (name: string, scenario: Scenario) => Preset
  renamePreset: (id: string, name: string) => void
  removePreset: (id: string) => void
}

/** Best-effort unique id; falls back when crypto.randomUUID is unavailable (old/test envs). */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Deep-ish copy so a preset is a snapshot, immune to later edits of the live scenario. */
function cloneScenario(scenario: Scenario): Scenario {
  return { ...scenario, params: { ...scenario.params }, camera: scenario.camera ? { ...scenario.camera } : undefined }
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set) => ({
      presets: [],
      savePreset: (name, scenario) => {
        const preset: Preset = {
          id: newId(),
          name: name.trim(),
          scenario: cloneScenario(scenario),
          createdAt: Date.now(),
        }
        set((s) => ({ presets: [preset, ...s.presets] }))
        return preset
      },
      renamePreset: (id, name) =>
        set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) })),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    {
      name: 'particle-lab:presets',
      version: 1,
      storage: createJSONStorage(() => clientStorage),
      partialize: (s) => ({ presets: s.presets }),
    },
  ),
)
