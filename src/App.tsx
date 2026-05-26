import { useState } from 'react'
import './App.css'
import { SimulationCanvas } from './render/SimulationCanvas'
import { ControlPanel } from './ui/ControlPanel'
import { Measurements } from './ui/Measurements'
import { ModeSelect } from './ui/ModeSelect'
import { Toolbar } from './ui/Toolbar'
import { StatusReadout } from './ui/StatusReadout'
import { Button } from './ui/controls/Button'
import { ChartIcon } from './ui/icons'

/**
 * Application shell. Pure composition — no simulation state lives here. The left instrument
 * panel (mode + parameters) and toolbar read/write the param store directly, and the canvas
 * reads from it, so there is no prop-drilling. Measurements live in a dedicated right-hand
 * dock (collapsible) so the charts get width and the controls column stays uncluttered.
 */
export default function App() {
  const [dockOpen, setDockOpen] = useState(true)

  return (
    <div className={`app${dockOpen ? '' : ' app--dock-collapsed'}`}>
      <header className="app__topbar">
        <span className="app__brand">Particle&nbsp;Lab</span>
        <div className="app__topbar-actions">
          <Toolbar />
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

      <aside className="app__sidebar">
        <ModeSelect />
        <ControlPanel />
      </aside>

      <main className="app__viewport">
        <SimulationCanvas />
        <div className="app__status-overlay">
          <StatusReadout />
        </div>
      </main>

      {dockOpen && (
        <aside className="app__dock">
          <Measurements />
        </aside>
      )}
    </div>
  )
}
