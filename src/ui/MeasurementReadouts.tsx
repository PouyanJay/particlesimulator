import { useTelemetryStore } from '../state/telemetryStore'
import { useReadoutUnits, formatSi } from './measurementDisplay'

/**
 * Numeric readout of the system's conserved / derived bulk quantities — kinetic energy,
 * temperature, pressure, and total momentum — for the active mode. Only the quantities the
 * mode actually reports are shown (e.g. temperature/pressure appear for the gases, not boids),
 * and an inelastic run is flagged.
 *
 * Values are dimensionless reduced units by default. On the Lennard-Jones gas with a real
 * substance selected, they are converted to SI via the law of corresponding states (see
 * `substances`); the unit then appears in the label and the figures use SI-aware formatting.
 */
export function MeasurementReadouts() {
  const telemetry = useTelemetryStore((s) => s.current)
  const { substance, dimensional } = useReadoutUnits()

  if (!telemetry) {
    return <div className="readouts readouts--empty">Run the simulation to measure</div>
  }

  const { kineticEnergy, temperature, pressure, momentum, inelastic } = telemetry
  const momentumMagnitude = momentum ? Math.hypot(momentum[0], momentum[1], momentum[2]) : null

  // Dimensional (real-substance) display: multiply each reduced value by the substance scale,
  // label with its SI unit, and format with SI-aware precision.
  if (dimensional) {
    const { scale, unit } = substance
    const labelled = (name: string, u: string) => (u ? `${name} (${u})` : name)
    return (
      <>
        <dl className="readouts" aria-label="Conserved quantities">
          <Readout label={labelled('Kinetic energy', unit.energy)} value={formatSi(kineticEnergy * scale.energy)} />
          {temperature !== undefined && (
            <Readout label={labelled('Temperature', unit.temperature)} value={formatSi(temperature * scale.temperature)} />
          )}
          {pressure !== undefined && (
            <Readout label={labelled('Pressure', unit.pressure)} value={formatSi(pressure * scale.pressure)} />
          )}
          {momentumMagnitude !== null && (
            <Readout label={labelled('Total momentum', unit.momentum)} value={formatSi(momentumMagnitude * scale.momentum)} />
          )}
          {inelastic ? (
            <div className="readouts__flag" role="note">
              Inelastic — kinetic energy not conserved
            </div>
          ) : null}
        </dl>
        <p className="readouts__note">{substance.label} · SI units (corresponding states)</p>
      </>
    )
  }

  // Default: dimensionless reduced units — bare numbers, one convention note.
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
      <p className="readouts__note">Dimensionless reduced units · k_B = 1</p>
    </>
  )
}

// Values are a right-aligned numeric column; the unit (if any) lives in the label.
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readouts__row">
      <dt className="readouts__label">{label}</dt>
      <dd className="readouts__value">{value}</dd>
    </div>
  )
}
