import { useParamStore } from '../../state/paramStore'
import { useTelemetryStore } from '../../state/telemetryStore'

const GAS_MODES = new Set(['elastic-gas', 'molecular-dynamics'])
/** Z axis shown on the gauge: 0…2, with the ideal value Z = 1 at the centre. */
const Z_AXIS_MAX = 2

/**
 * Ideal-gas check via the **compressibility factor** Z = P·V / (N·k·T) (reduced units, k = 1).
 * Z = 1 is exactly ideal; the gauge marks that reference line and plots the live Z against it,
 * so the gap (the gas's non-ideal behaviour) reads at a glance — no invented cutoff. A dilute
 * hard-sphere gas sits at Z ≈ 1; the Lennard-Jones gas departs as its interactions matter
 * (compress or cool it to push Z off 1). Gas modes only, once pressure has been measured.
 */
export function GasLawPanel() {
  const modeId = useParamStore((s) => s.modeId)
  const t = useTelemetryStore((s) => s.current)

  if (!GAS_MODES.has(modeId) || !t || !t.pressure || t.volume === undefined || t.temperature === undefined) {
    return null
  }

  const pv = t.pressure * t.volume
  const nkt = t.particleCount * t.temperature // k = 1
  const z = nkt !== 0 ? pv / nkt : 0
  const deviationPct = (z - 1) * 100
  const signedPct = `${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}%`
  // Grade how far the gas is from ideal: >20% orange, >40% red (pastel).
  const severity = severityFor(Math.abs(deviationPct))

  return (
    <section className="gaslaw" aria-label="Ideal-gas check">
      <h3 className="gaslaw__title">Ideal-gas check</h3>
      <dl className="gaslaw__rows">
        <Row label="P·V" value={pv.toFixed(2)} />
        <Row label="N·k·T" value={nkt.toFixed(2)} />
        <Row label="Z = P·V / N·k·T" value={z.toFixed(3)} accent />
        <Row label="Deviation from ideal" value={signedPct} severity={severity} />
      </dl>
      <ZGauge z={z} severity={severity} />
    </section>
  )
}

type Severity = 'ideal' | 'warn' | 'danger'

function severityFor(absDeviationPct: number): Severity {
  if (absDeviationPct > 40) return 'danger'
  if (absDeviationPct > 20) return 'warn'
  return 'ideal'
}

/** Compact gauge: the Z = 1 ideal reference line and the live Z marker on a 0…2 track. */
function ZGauge({ z, severity }: { z: number; severity: Severity }) {
  const idealX = (1 / Z_AXIS_MAX) * 100 // Z = 1 → centre
  const markerX = Math.max(2, Math.min(98, (z / Z_AXIS_MAX) * 100)) // clamp so it stays visible
  const barX = Math.min(idealX, markerX)
  const barW = Math.abs(markerX - idealX)
  return (
    <div className={`zgauge zgauge--${severity}`}>
      <svg
        className="zgauge__plot"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Compressibility Z = ${z.toFixed(3)}; ideal is Z = 1`}
      >
        <line className="zgauge__track" x1="0" y1="8" x2="100" y2="8" vectorEffect="non-scaling-stroke" />
        <rect className="zgauge__deviation" x={barX} y="6" width={barW} height="4" />
        <line className="zgauge__ideal" x1={idealX} y1="1" x2={idealX} y2="15" vectorEffect="non-scaling-stroke" />
        <line className="zgauge__marker" x1={markerX} y1="0" x2={markerX} y2="16" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="zgauge__scale">
        <span>0</span>
        <span>ideal</span>
        <span>{Z_AXIS_MAX}</span>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  accent,
  severity,
}: {
  label: string
  value: string
  accent?: boolean
  severity?: Severity
}) {
  const classes = ['gaslaw__value']
  if (accent) classes.push('gaslaw__value--accent')
  if (severity && severity !== 'ideal') classes.push(`gaslaw__value--${severity}`)
  return (
    <div className="gaslaw__row">
      <dt className="gaslaw__label">{label}</dt>
      <dd className={classes.join(' ')}>{value}</dd>
    </div>
  )
}
