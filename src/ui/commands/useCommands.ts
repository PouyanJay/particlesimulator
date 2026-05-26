import { useParamStore } from '../../state/paramStore'
import { useParamHistory } from '../../state/useParamHistory'
import { useUiStore } from '../../state/uiStore'
import type { Command } from './commandModel'

/**
 * Assembles the command-palette action list from the current app state. Titles and disabled
 * flags are reactive (play vs pause, undo availability); `run` handlers read fresh state via
 * `getState()` so they stay correct regardless of when they fire.
 */
export function useCommands(): Command[] {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const { undo, redo, canUndo, canRedo } = useParamHistory()
  const openOverlay = useUiStore((s) => s.openOverlay)

  return [
    {
      id: 'play-pause',
      title: isPlaying ? 'Pause' : 'Play',
      group: 'Playback',
      keywords: 'space run resume stop',
      run: () => useParamStore.getState().togglePlaying(),
    },
    {
      id: 'reset',
      title: 'Reset with new initial conditions',
      group: 'Playback',
      keywords: 'seed randomize restart',
      run: () => useParamStore.getState().randomizeSeed(),
    },
    { id: 'undo', title: 'Undo', group: 'Edit', keywords: 'history back', disabled: !canUndo, run: undo },
    { id: 'redo', title: 'Redo', group: 'Edit', keywords: 'history forward', disabled: !canRedo, run: redo },
    {
      id: 'presets',
      title: 'Presets — save or load a setup',
      group: 'Scenario',
      keywords: 'save load bookmark',
      run: () => openOverlay('presets'),
    },
    {
      id: 'share',
      title: 'Share scenario link',
      group: 'Scenario',
      keywords: 'url copy embed',
      run: () => openOverlay('share'),
    },
    {
      id: 'scenarios',
      title: 'Open a curated scenario',
      group: 'Scenario',
      keywords: 'demo gallery examples',
      run: () => openOverlay('scenarios'),
    },
    {
      id: 'export',
      title: 'Export & record…',
      group: 'Export',
      keywords: 'screenshot video csv json data download record',
      run: () => openOverlay('export'),
    },
    {
      id: 'challenges',
      title: 'Guided challenges',
      group: 'Learn',
      keywords: 'lesson tutorial teach',
      run: () => openOverlay('challenges'),
    },
    {
      id: 'toggle-view',
      title: 'Toggle 2D / 3D view',
      group: 'View',
      keywords: 'projection orthographic perspective dimension',
      run: () => {
        const s = useParamStore.getState()
        s.setView(s.view === '2d' ? '3d' : '2d')
      },
    },
  ]
}
