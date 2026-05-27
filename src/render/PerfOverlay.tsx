import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Perf } from 'r3f-perf'
import Stats from 'stats-gl'

/**
 * Dev-only profiling overlay: r3f-perf's panel (FPS / ms / memory / draw calls / GPU timing)
 * plus a stats-gl meter. Mounted lazily and only behind `?stats` in dev (see SimulationCanvas),
 * so it never reaches the production bundle. Used to verify the per-tier performance budgets.
 */
export function PerfOverlay() {
  const gl = useThree((s) => s.gl)
  const statsRef = useRef<Stats | null>(null)

  useEffect(() => {
    let mounted = true
    const stats = new Stats({ trackGPU: true })
    const dom = stats.dom
    // Positioning a third-party debug widget's raw DOM node — intentionally outside the design
    // token system (this overlay is dev-only and never ships to production).
    dom.style.cssText += ';position:fixed;top:8px;right:8px;left:auto;z-index:1000;'
    document.body.appendChild(dom)
    // init patches the (WebGPU/WebGL) renderer for GPU timing; it's async and may no-op.
    void stats
      .init(gl)
      .then(() => {
        if (mounted) statsRef.current = stats
      })
      .catch(() => {})
    return () => {
      mounted = false
      statsRef.current = null
      dom.remove()
    }
  }, [gl])

  useFrame(() => statsRef.current?.update())

  return <Perf position="top-left" />
}
