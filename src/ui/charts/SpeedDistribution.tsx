import { useMemo } from 'react'
import { useTelemetryStore } from '../../state/telemetryStore'
import { computeSpeedHistogram } from '../../sim-core/measure/speedHistogram'
import { maxwellBoltzmannPdf } from '../../sim-core/measure/maxwellBoltzmann'

const BIN_COUNT = 28
// SVG view box (responsive via CSS width); plotting area inside a small margin.
const VW = 100
const VH = 60

/**
 * Live speed-distribution histogram with the analytic Maxwell–Boltzmann curve overlaid.
 * For a thermalised gas the bars converge onto the curve — the lab's "theory emerges from
 * the simulation" moment. Reads per-particle speed samples from telemetry; the binning
 * and analytic PDF are the unit-tested sim-core helpers.
 */
export function SpeedDistribution() {
  const samples = useTelemetryStore((s) => s.current?.speedSamples)

  const model = useMemo(() => {
    if (!samples || samples.length === 0) return null
    const n = samples.length
    let sumSq = 0
    let max = 0
    for (let i = 0; i < n; i++) {
      const s = samples[i]
      sumSq += s * s
      if (s > max) max = s
    }
    const meanSquare = sumSq / n
    const maxSpeed = Math.max(1e-6, max * 1.05)
    const hist = computeSpeedHistogram(samples, n, BIN_COUNT, maxSpeed)
    const curve = hist.binCenters.map((v) => maxwellBoltzmannPdf(v, meanSquare))
    const peak = Math.max(...hist.density, ...curve, 1e-6)
    return { hist, curve, peak }
  }, [samples])

  if (!model) {
    return <div className="chart chart--empty">No speed data for this mode</div>
  }

  const { hist, curve, peak } = model
  const barW = VW / hist.density.length
  const y = (density: number) => VH - (density / peak) * VH
  const curvePoints = curve
    .map((d, i) => `${(i + 0.5) * barW},${y(d)}`)
    .join(' ')

  return (
    <svg
      className="distribution"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Speed distribution with Maxwell–Boltzmann overlay"
    >
      {hist.density.map((d, i) => (
        <rect
          key={i}
          className="distribution__bar"
          x={i * barW + barW * 0.1}
          y={y(d)}
          width={barW * 0.8}
          height={VH - y(d)}
        />
      ))}
      <polyline className="distribution__curve" points={curvePoints} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
