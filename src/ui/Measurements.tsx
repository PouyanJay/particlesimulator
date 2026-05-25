import { SpeedChart } from './charts/SpeedChart'
import { SpeedDistribution } from './charts/SpeedDistribution'

/**
 * Live measurement panel — turns the simulation into a lab. Shows average speed over
 * time and the speed distribution with the analytic Maxwell–Boltzmann overlay.
 * (Telemetry is sampled by the CPU sim loop; GPU-resident modes don't feed it yet.)
 */
export function Measurements() {
  return (
    <section className="panel measurements" aria-label="Measurements">
      <h2 className="panel__title">Measurements</h2>
      <div className="measurements__group">
        <div className="measurements__chart">
          <span className="measurements__label">Average speed</span>
          <SpeedChart />
        </div>
        <div className="measurements__chart">
          <span className="measurements__label">
            Speed distribution
            <span className="measurements__legend"> — Maxwell–Boltzmann</span>
          </span>
          <SpeedDistribution />
        </div>
      </div>
    </section>
  )
}
