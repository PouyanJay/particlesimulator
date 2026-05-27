import { useUiStore } from '../../state/uiStore'
import { useOnboardingStore } from '../../state/onboardingStore'
import { Dialog } from '../controls/Dialog'
import { Button } from '../controls/Button'
import { Kbd } from '../controls/Kbd'
import { MOD } from '../platform'

/**
 * First-visit onboarding. Explains what the lab is and points to the key entry points; opens
 * automatically once (persisted via the onboarding store) and is reopenable from the help
 * button. Closing it marks onboarding as seen.
 */
export function WelcomeDialog() {
  const open = useUiStore((s) => s.overlay === 'welcome')
  const closeOverlay = useUiStore((s) => s.closeOverlay)
  const markSeen = useOnboardingStore((s) => s.markSeen)

  function dismiss(): void {
    markSeen()
    closeOverlay()
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title="Welcome to Particle Lab"
      description="A GPU-accelerated playground for particle physics — tune it, watch it, measure it, share it."
      footer={
        <Button variant="primary" onClick={dismiss}>
          Start exploring
        </Button>
      }
    >
      <ul className="welcome-list">
        <li>
          <strong>Pick a mode</strong> in the left panel — gases, gravity, flocking, particle life, and
          more. Each one explains what to look for.
        </li>
        <li>
          <strong>Tune parameters</strong> live; the right dock measures temperature, pressure, energy, and
          the speed distribution as you go.
        </li>
        <li>
          <strong>Curated scenarios</strong> and <strong>guided challenges</strong> (top bar) drop you into
          a phenomenon or walk you through a concept.
        </li>
        <li>
          <strong>Save, share, and record</strong> — presets, a shareable link, and video/GIF/PNG capture.
        </li>
        <li>
          Press <Kbd>{MOD}K</Kbd> any time for the command palette; <Kbd>Space</Kbd> plays/pauses.
        </li>
      </ul>
    </Dialog>
  )
}
