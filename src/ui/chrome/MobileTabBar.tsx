import { useParamStore } from '../../state/paramStore'
import { Button } from '../controls/Button'
import { PlayIcon, PauseIcon, SlidersIcon, ChartIcon } from '../icons'

/** Which dismissible bottom sheet is currently open in the compact layout (none = `null`). */
export type MobileSheet = 'controls' | 'measurements' | null

interface MobileTabBarProps {
  activeSheet: MobileSheet
  onToggleControls: () => void
  onToggleMeasurements: () => void
}

/**
 * Bottom action bar for the compact (touch) layout. Frames a full-bleed canvas with the two
 * primary surfaces — Controls and Measurements as slide-up sheets — and a prominent central
 * play/pause, all within thumb reach. Replaces the desktop sidebar/dock columns on narrow
 * viewports. The lab actions (share, export, presets…) live behind the "More" button in the
 * compact top bar.
 */
export function MobileTabBar({
  activeSheet,
  onToggleControls,
  onToggleMeasurements,
}: MobileTabBarProps) {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const togglePlaying = useParamStore((s) => s.togglePlaying)

  return (
    <nav className="app__tabbar" aria-label="Primary">
      <button
        type="button"
        className="tabbar__item"
        aria-haspopup="dialog"
        aria-pressed={activeSheet === 'controls'}
        onClick={onToggleControls}
      >
        <SlidersIcon />
        <span className="tabbar__label">Controls</span>
      </button>

      <Button
        variant="primary"
        icon
        className="tabbar__play"
        onClick={togglePlaying}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Button>

      <button
        type="button"
        className="tabbar__item"
        aria-haspopup="dialog"
        aria-pressed={activeSheet === 'measurements'}
        onClick={onToggleMeasurements}
      >
        <ChartIcon />
        <span className="tabbar__label">Measurements</span>
      </button>
    </nav>
  )
}
