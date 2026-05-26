import type { ReactNode } from 'react'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import type { Telemetry } from '../sim-core/types'

/**
 * The pedagogy panel: shows the governing law for the active mode and, for the gases, checks
 * it live. The ideal-gas law P·V = N·k_B·T is evaluated from telemetry (reduced units, k_B = 1)
 * with both sides shown side by side — they track each other as you change the run, which is
 * the "theory holds in the simulation" moment. Other modes show their governing equation for
 * context. Reads the active mode and the latest telemetry; no simulation logic here.
 */
export function EquationPanel() {
  const modeId = useParamStore((s) => s.modeId)
  const telemetry = useTelemetryStore((s) => s.current)

  const content = renderLaw(modeId, telemetry)
  if (!content) return null

  return (
    <section className="equation" aria-label="Governing law">
      <h3 className="equation__title">Governing law</h3>
      {content}
    </section>
  )
}

function renderLaw(modeId: string, t: Telemetry | null) {
  switch (modeId) {
    case 'elastic-gas':
    case 'molecular-dynamics':
      return <IdealGasLaw telemetry={t} />
    case 'nbody':
    case 'gpu-nbody':
      return (
        <Law formula={<>F = G·m₁m₂ / r²</>} caption="Newton's law of universal gravitation (every body attracts every other)." />
      )
    case 'electrostatics':
      return <Law formula={<>F = k·q₁q₂ / r²</>} caption="Coulomb's law — like charges repel, opposite charges attract." />
    case 'boids':
      return (
        <Law
          formula={<>v ← v + w_s·separation + w_a·alignment + w_c·cohesion</>}
          caption="Reynolds' flocking rules: avoid crowding, match heading, steer to the group centre."
        />
      )
    case 'particle-life':
      return (
        <Law
          formula={<>F_ij = f(r / R, A_ij)</>}
          caption="An asymmetric type×type attraction matrix A drives emergent life-like structure."
        />
      )
    default:
      return null
  }
}

/** Static governing equation with a one-line explanation. */
function Law({ formula, caption }: { formula: ReactNode; caption: string }) {
  return (
    <>
      <p className="equation__formula">{formula}</p>
      <p className="equation__caption">{caption}</p>
    </>
  )
}

/** The ideal-gas law with both sides evaluated live from telemetry (k_B = 1). */
function IdealGasLaw({ telemetry }: { telemetry: Telemetry | null }) {
  const formula = (
    <p className="equation__formula">
      P·V = N·k<sub>B</sub>·T
    </p>
  )
  if (!telemetry || telemetry.pressure === undefined || telemetry.volume === undefined || telemetry.temperature === undefined) {
    return (
      <>
        {formula}
        <p className="equation__caption">The ideal-gas law — run the gas to evaluate both sides.</p>
      </>
    )
  }
  const pv = telemetry.pressure * telemetry.volume
  const nkt = telemetry.particleCount * telemetry.temperature // k_B = 1 (reduced units)
  return (
    <>
      {formula}
      <dl className="equation__check">
        <div className="equation__term">
          <dt>P·V</dt>
          <dd>{pv.toFixed(2)}</dd>
        </div>
        <div className="equation__term">
          <dt>
            N·k<sub>B</sub>·T
          </dt>
          <dd>{nkt.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="equation__caption">Both sides track each other — kinetic theory, live (reduced units).</p>
    </>
  )
}
