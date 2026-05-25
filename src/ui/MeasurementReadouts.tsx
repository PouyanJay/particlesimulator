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

  const { kineticEnergy, temperature, pressure, momentum, inelastic } = telemetry
  const momentumMagnitude = momentum ? Math.hypot(momentum[0], momentum[1], momentum[2]) : null

  return (
    <>
      <dl className="readouts" aria-label="Conserved quantities">
        <Readout label="Kinetic energy" value={kineticEnergy.toFixed(2)} />
        {temperature !== undefined && <Readout label="Temperature" value={temperature.toFixed(3)} />}
        {pressure !== undefined && <Readout label="Pressure" value={pressure.toFixed(3)} />}
        {momentumMagnitude !== null && <Readout label="Total momentum" value={momentumMagnitude.toFixed(3)} />}
        {inelastic ? (
          <div className="readouts__flag" role="note">
            Inelastic — kinetic energy not conserved
          </div>
        ) : null}
      </dl>
      {/* The lab models no specific substance, so every value is a pure number. */}
      <p className="readouts__note">Dimensionless reduced units · k_B = 1</p>
    </>
  )
}

// Values are bare numbers (reduced units), so they form a clean right-aligned column.
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readouts__row">
      <dt className="readouts__label">{label}</dt>
      <dd className="readouts__value">{value}</dd>
    </div>
  )
}
