import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useTelemetryStore } from '../../state/telemetryStore'

// Canvas colors mirror the design tokens (uPlot can't read CSS vars). Keep in sync.
const ACCENT = '#6366f1'
const AXIS = '#6b7588'
const GRID = '#232a37'
const HEIGHT = 110

/** Live average-speed-over-time stream, drawn with uPlot (canvas, high-frequency safe). */
export function SpeedChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  // Create/destroy the uPlot instance with the element (StrictMode-safe via effect cleanup).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const opts: uPlot.Options = {
      width: el.clientWidth || 280,
      height: HEIGHT,
      padding: [8, 8, 0, 4],
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        { show: false },
        {
          stroke: AXIS,
          size: 38,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1 },
          font: '11px ui-monospace, monospace',
        },
      ],
      series: [{}, { stroke: ACCENT, width: 2, points: { show: false } }],
    }
    const plot = new uPlot(opts, [[], []], el)
    plotRef.current = plot
    const ro = new ResizeObserver(() => plot.setSize({ width: el.clientWidth || 280, height: HEIGHT }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      plot.destroy()
      plotRef.current = null
    }
  }, [])

  // Feed new samples whenever the rolling history updates.
  const history = useTelemetryStore((s) => s.speedHistory)
  useEffect(() => {
    const plot = plotRef.current
    if (!plot) return
    const xs = history.map((_, i) => i)
    plot.setData([xs, history])
  }, [history])

  return <div className="chart" ref={containerRef} aria-label="Average speed over time" />
}
