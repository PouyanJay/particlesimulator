import { useTelemetryStore } from '../state/telemetryStore'

/**
 * Numeric readout of the system's conserved / derived bulk quantities — kinetic energy,
 * temperature, pressure, and total momentum — for the active mode. Only the quantities the
 * mode actually reports are shown (e.g. temperature/pressure appear for the gases, not for
 * boids), and an inelastic run is flagged so the reader knows energy will drift. Values come
 * straight from the telemetry store; the figures are mono + tabular so they don't jitter.
 */
export function MeasurementReadouts() {
  const telemetry = useTelemetryStore((s) => s.current)

  if (!telemetry) {
    return <div className="readouts readouts--empty">Run the simulation to measure</div>
  }

  const { kineticEnergy, temperature, pressure, momentum, inelastic, units } = telemetry
  const momentumMagnitude = momentum ? Math.hypot(momentum[0], momentum[1], momentum[2]) : null

  return (
    <dl className="readouts" aria-label="Conserved quantities">
      <Readout label="Kinetic energy" value={kineticEnergy.toFixed(2)} unit={units?.energy} />
      {temperature !== undefined && <Readout label="Temperature" value={temperature.toFixed(3)} unit={units?.temperature} />}
      {pressure !== undefined && <Readout label="Pressure" value={pressure.toFixed(3)} unit={units?.pressure} />}
      {momentumMagnitude !== null && (
        <Readout label="Total momentum" value={momentumMagnitude.toFixed(3)} unit={units?.momentum} />
      )}
      {inelastic ? (
        <div className="readouts__flag" role="note">
          Inelastic — kinetic energy not conserved
        </div>
      ) : null}
    </dl>
  )
}

// The unit lives in the label — "Kinetic energy (J)" — so the values form a clean,
// right-aligned numeric column (per the design system's tabular-figure rule).
function Readout({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="readouts__row">
      <dt className="readouts__label">{unit ? `${label} (${unit})` : label}</dt>
      <dd className="readouts__value">{value}</dd>
    </div>
  )
}
