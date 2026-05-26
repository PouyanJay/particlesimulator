import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
import { hydrateScenarioFromLocation } from './render/bootstrapScenario'

// A share link carries the scenario in the URL hash — apply it before first render so it wins
// over the persisted local scenario and there's no flash of the default setup.
hydrateScenarioFromLocation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
