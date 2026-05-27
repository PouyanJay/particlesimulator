import { useParamStore } from '../../state/paramStore'
import { useUiStore } from '../../state/uiStore'
import { Button } from '../controls/Button'
import { Logo } from './Logo'
import { ResetIcon, MoreIcon } from '../icons'

/**
 * Slim top bar for the compact (touch) layout. Keeps only the brand and the two things that
 * don't belong in the bottom action bar — Reset, and a "More" button that opens the command
 * palette (the single searchable surface for every lab action: scenarios, presets, share,
 * export, undo/redo, view toggle…). Play/pause and the panel sheets live in {@link MobileTabBar}.
 */
export function MobileTopBar() {
  const randomizeSeed = useParamStore((s) => s.randomizeSeed)
  const openOverlay = useUiStore((s) => s.openOverlay)

  return (
    <header className="app__topbar app__topbar--compact">
      <span className="app__brand">
        <Logo className="app__brand-mark" />
        Particle&nbsp;Lab
      </span>
      <div className="app__topbar-actions">
        <Button
          icon
          onClick={randomizeSeed}
          aria-label="Reset"
          title="Reset with new initial conditions"
        >
          <ResetIcon />
        </Button>
        <Button icon onClick={() => openOverlay('palette')} aria-label="More actions" title="More actions">
          <MoreIcon />
        </Button>
      </div>
    </header>
  )
}
