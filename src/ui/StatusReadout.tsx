import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'

/** Compact live readout of run state and derived telemetry. Mono, tabular figures. */
export function StatusReadout() {
  const isPlaying = useParamStore((s) => s.isPlaying)
  const telemetry = useTelemetryStore((s) => s.current)

  return (
    <div className="status" aria-live="polite">
      <span className={`status__dot status__dot--${isPlaying ? 'running' : 'paused'}`} aria-hidden />
      <span className="status__label">{isPlaying ? 'Running' : 'Paused'}</span>
      {telemetry ? (
        <>
          <Metric label="Particles" value={telemetry.particleCount.toString()} />
          <Metric label="Avg speed" value={telemetry.averageSpeed.toFixed(3)} unit={telemetry.units?.speed} />
          <Metric label="Kinetic energy" value={telemetry.kineticEnergy.toFixed(2)} unit={telemetry.units?.energy} />
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <span className="status__metric">
      <span className="status__metric-label">{unit ? `${label} (${unit})` : label}</span>
      <span className="status__metric-value">{value}</span>
    </span>
  )
}
