import { describe, it, expect, beforeEach } from 'vitest'
import { usePresetStore } from './presetStore'
import type { Scenario } from '../sim-core/scenario'

const scenario: Scenario = { modeId: 'boids', seed: 5, params: { particleCount: 40 } }

beforeEach(() => {
  usePresetStore.setState({ presets: [] })
})

describe('presetStore', () => {
  it('saves a named preset and returns it with a stable id', () => {
    const preset = usePresetStore.getState().savePreset('Flocking demo', scenario)
    expect(preset.name).toBe('Flocking demo')
    expect(preset.scenario).toEqual(scenario)
    expect(preset.id).toBeTruthy()
    expect(usePresetStore.getState().presets).toHaveLength(1)
  })

  it('trims whitespace from the name', () => {
    const preset = usePresetStore.getState().savePreset('  spacey  ', scenario)
    expect(preset.name).toBe('spacey')
  })

  it('stores a defensive copy of the scenario (later store edits do not mutate it)', () => {
    const live: Scenario = { modeId: 'boids', seed: 1, params: { particleCount: 10 } }
    usePresetStore.getState().savePreset('snap', live)
    live.params.particleCount = 9999
    expect(usePresetStore.getState().presets[0].scenario.params.particleCount).toBe(10)
  })

  it('renames a preset by id', () => {
    const { id } = usePresetStore.getState().savePreset('old', scenario)
    usePresetStore.getState().renamePreset(id, 'new name')
    expect(usePresetStore.getState().presets[0].name).toBe('new name')
  })

  it('removes a preset by id', () => {
    const a = usePresetStore.getState().savePreset('a', scenario)
    const b = usePresetStore.getState().savePreset('b', scenario)
    usePresetStore.getState().removePreset(a.id)
    expect(usePresetStore.getState().presets.map((p) => p.id)).toEqual([b.id])
  })

  it('keeps presets newest-first', () => {
    usePresetStore.getState().savePreset('first', scenario)
    usePresetStore.getState().savePreset('second', scenario)
    expect(usePresetStore.getState().presets.map((p) => p.name)).toEqual(['second', 'first'])
  })
})
