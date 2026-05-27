import { useUiStore } from '../../state/uiStore'
import { Button } from '../controls/Button'
import { Tooltip } from '../controls/Tooltip'
import { SaveIcon, ShareIcon, DownloadIcon, BookIcon, CommandIcon, GraduationIcon, HelpIcon } from '../icons'
import { MOD } from '../platform'

/**
 * Topbar lab actions: open the preset manager, share dialog, export/record, curated
 * scenarios, guided challenges, and the command palette. Each just flips the UI store's
 * active overlay; the overlays mount at the app root and read it.
 */
export function LabActions() {
  const open = useUiStore((s) => s.openOverlay)

  return (
    <div className="lab-actions" role="group" aria-label="Lab actions">
      <Tooltip label="Curated scenarios">
        <Button icon aria-label="Curated scenarios" onClick={() => open('scenarios')}>
          <BookIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Guided challenges">
        <Button icon aria-label="Guided challenges" onClick={() => open('challenges')}>
          <GraduationIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Presets">
        <Button icon aria-label="Presets" onClick={() => open('presets')}>
          <SaveIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Export & record">
        <Button icon aria-label="Export and record" onClick={() => open('export')}>
          <DownloadIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Share">
        <Button icon aria-label="Share scenario" onClick={() => open('share')}>
          <ShareIcon />
        </Button>
      </Tooltip>
      <Tooltip label={`Commands (${MOD}K)`}>
        <Button icon aria-label="Open command palette" onClick={() => open('palette')}>
          <CommandIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Help & welcome">
        <Button icon aria-label="Help and welcome" onClick={() => open('welcome')}>
          <HelpIcon />
        </Button>
      </Tooltip>
    </div>
  )
}
