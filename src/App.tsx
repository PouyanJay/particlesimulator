import './App.css'
import { SimulationCanvas } from './render/SimulationCanvas'
import { ControlPanel } from './ui/ControlPanel'
import { Toolbar } from './ui/Toolbar'
import { StatusReadout } from './ui/StatusReadout'

/**
 * Application shell. Pure composition — no simulation state lives here. The control
 * panel and toolbar read/write the param store directly, and the canvas reads from it,
 * so there is no prop-drilling (contrast the pre-refactor App which threaded ~20 props).
 */
export default function App() {
  return (
    <div className="app">
      <header className="app__topbar">
        <span className="app__brand">Particle&nbsp;Lab</span>
        <Toolbar />
      </header>
      <aside className="app__sidebar">
        <ControlPanel />
      </aside>
      <main className="app__viewport">
        <SimulationCanvas />
        <div className="app__status-overlay">
          <StatusReadout />
        </div>
      </main>
    </div>
  )
}
