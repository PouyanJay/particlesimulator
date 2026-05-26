import { useParamStore } from '../state/paramStore'
import { SpeedChart } from './charts/SpeedChart'
import { EnergyChart } from './charts/EnergyChart'
import { SpeedDistribution } from './charts/SpeedDistribution'
import { MeasurementReadouts } from './MeasurementReadouts'
import { GasLawPanel } from './GasLawPanel'
import { UnitsSelect } from './UnitsSelect'

/**
 * Live measurement panel — turns the simulation into a lab. Shows the conserved/derived
 * quantities (energy, temperature, pressure, momentum), average speed over time, and the
 * speed distribution with the analytic Maxwell–Boltzmann overlay. The Lennard-Jones gas also
 * offers a real-substance unit selector (reduced ↔ Argon/Neon/Krypton/Xenon).
 */
export function Measurements() {
  // The substance unit mapping is rigorous only for the LJ gas, so the selector shows there.
  const isLennardJones = useParamStore((s) => s.modeId === 'molecular-dynamics')

  return (
    <section className="panel measurements" aria-label="Measurements">
      <h2 className="panel__title">Measurements</h2>
      {isLennardJones && <UnitsSelect />}
      <MeasurementReadouts />
      <GasLawPanel />
      <div className="measurements__group">
        <div className="measurements__chart">
          <span className="measurements__label">Average speed</span>
          <SpeedChart />
        </div>
        <div className="measurements__chart">
          <span className="measurements__label">Kinetic energy</span>
          <EnergyChart />
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
