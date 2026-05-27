import { useEffect, useState } from 'react'
import './App.css'
import { SimulationCanvas } from './render/SimulationCanvas'
import { ControlPanel } from './ui/panels/ControlPanel'
import { Measurements } from './ui/panels/Measurements'
import { ModeSelect } from './ui/chrome/ModeSelect'
import { ViewToggle } from './ui/chrome/ViewToggle'
import { Toolbar } from './ui/chrome/Toolbar'
import { LabActions } from './ui/chrome/LabActions'
import { Overlays } from './ui/dialogs/Overlays'
import { StatusReadout } from './ui/chrome/StatusReadout'
import { RecordingIndicator } from './ui/chrome/RecordingIndicator'
import { MobileTopBar } from './ui/chrome/MobileTopBar'
import { MobileTabBar, type MobileSheet } from './ui/chrome/MobileTabBar'
import { Button } from './ui/controls/Button'
import { Dialog } from './ui/controls/Dialog'
import { ChartIcon } from './ui/icons'
import { useGlobalShortcuts } from './ui/hooks/useGlobalShortcuts'
import { useIsCompact } from './ui/hooks/useMediaQuery'
import { initLifecycleSync } from './state/lifecycle'
import { isEmbedRoute } from './state/shareLink'
import { useUiStore } from './state/uiStore'
import { useOnboardingStore } from './state/onboardingStore'

// Embed mode (iframe target) is decided once from the URL: it hides all chrome and shows only
// the canvas, so a shared `?embed` link drops straight into the simulation.
const EMBED = typeof window !== 'undefined' && isEmbedRoute(window.location)

/**
 * Application shell. Pure composition — no simulation state lives here. The left instrument
 * panel (mode + parameters) and toolbar read/write the param store directly, and the canvas
 * reads from it, so there is no prop-drilling. Measurements live in a dedicated right-hand
 * dock (collapsible).
 *
 * Two responsive layouts share one always-mounted canvas (so resizing/rotating never re-inits
 * the WebGPU context): the docked desktop layout (sidebar · canvas · dock columns) and, below
 * {@link useIsCompact}'s breakpoint, a touch layout where the canvas goes full-bleed and the
 * panels become dismissible bottom sheets driven by a bottom action bar. In embed mode the
 * chrome is stripped to just the viewport.
 */
export default function App() {
  const [dockOpen, setDockOpen] = useState(true)
  const [sheet, setSheet] = useState<MobileSheet>(null)
  const isCompact = useIsCompact()
  useGlobalShortcuts()
  useEffect(() => initLifecycleSync(), [])

  // Opening one sheet closes the other — only one panel overlays the canvas at a time.
  const toggleSheet = (next: Exclude<MobileSheet, null>) =>
    setSheet((current) => (current === next ? null : next))

  // Show the onboarding welcome once, on the first visit (never in embed mode).
  useEffect(() => {
    if (EMBED) return
    if (!useOnboardingStore.getState().seen) useUiStore.getState().openOverlay('welcome')
  }, [])

  if (EMBED) {
    return (
      <div className="app app--embed">
        <main className="app__viewport">
          <SimulationCanvas />
          <div className="app__rec-overlay">
            <RecordingIndicator />
          </div>
          <div className="app__status-overlay">
            <StatusReadout />
          </div>
        </main>
      </div>
    )
  }

  const appClass = isCompact ? 'app app--compact' : `app${dockOpen ? '' : ' app--dock-collapsed'}`

  return (
    <div className={appClass}>
      {isCompact ? (
        <MobileTopBar />
      ) : (
        <header className="app__topbar">
          <span className="app__brand">Particle&nbsp;Lab</span>
          <div className="app__topbar-actions">
            <Toolbar />
            <span className="app__topbar-divider" aria-hidden="true" />
            <LabActions />
            <Button
              icon
              onClick={() => setDockOpen((o) => !o)}
              aria-pressed={dockOpen}
              aria-label="Toggle measurements panel"
              title="Toggle measurements"
            >
              <ChartIcon />
            </Button>
          </div>
        </header>
      )}

      {!isCompact && (
        <aside className="app__sidebar">
          <ModeSelect />
          <ViewToggle />
          <ControlPanel />
        </aside>
      )}

      <main className="app__viewport">
        <SimulationCanvas />
        <div className="app__rec-overlay">
          <RecordingIndicator />
        </div>
        <div className="app__status-overlay">
          <StatusReadout />
        </div>
      </main>

      {!isCompact && dockOpen && (
        <aside className="app__dock">
          <Measurements />
        </aside>
      )}

      {isCompact && (
        <>
          <MobileTabBar
            activeSheet={sheet}
            onToggleControls={() => toggleSheet('controls')}
            onToggleMeasurements={() => toggleSheet('measurements')}
          />
          <Dialog
            variant="sheet"
            open={sheet === 'controls'}
            onClose={() => setSheet(null)}
            title="Controls"
          >
            <ModeSelect />
            <ViewToggle />
            <ControlPanel />
          </Dialog>
          <Dialog
            variant="sheet"
            open={sheet === 'measurements'}
            onClose={() => setSheet(null)}
            title="Measurements"
          >
            <Measurements />
          </Dialog>
        </>
      )}

      <Overlays />
    </div>
  )
}
