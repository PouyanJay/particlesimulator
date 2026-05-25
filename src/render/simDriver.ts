import { createFixedTimestep } from '../sim-core/time/fixedTimestep'
import type { SimModeRegistry } from '../sim-core/registry'
import type { ParamValue, ParticleBuffers, SimMode, Telemetry } from '../sim-core/types'

/** A fully-specified, reproducible simulation setup. */
export interface Scenario {
  modeId: string
  seed: number
  params: Record<string, ParamValue>
}

export interface SimDriverOptions {
  registry: SimModeRegistry
  /** Fixed physics timestep in seconds (default 1/90). */
  fixedDt?: number
  /** How often telemetry is sampled, in simulated seconds (default 0.5). */
  telemetryIntervalSec?: number
}

/**
 * Drives a `SimMode` independently of any renderer: it owns the active mode instance,
 * advances it on a fixed timestep, and samples telemetry on an interval. This is the
 * testable core of the render layer — the React component only forwards real frame
 * deltas to `advance` and reads `getBuffers`/`consumeTelemetry`. No three.js, no React.
 */
export interface SimDriver {
  /** (Re)create and initialise the mode for a scenario, disposing any previous one. */
  load(scenario: Scenario): void
  /** Advance by the real elapsed time; steps the mode in fixed increments. */
  advance(realDeltaSec: number): void
  /** Latest particle buffers for rendering, or null if nothing is loaded. */
  getBuffers(): ParticleBuffers | null
  /** Returns a telemetry sample when one is pending (load + interval), else null. */
  consumeTelemetry(): Telemetry | null
  dispose(): void
}

export function createSimDriver(options: SimDriverOptions): SimDriver {
  const { registry, fixedDt = 1 / 90, telemetryIntervalSec = 0.5 } = options
  const clock = createFixedTimestep(fixedDt)

  let mode: SimMode | null = null
  let simTimeSinceTelemetry = 0
  let pendingTelemetry: Telemetry | null = null

  return {
    load(scenario) {
      mode?.dispose()
      mode = registry.create(scenario.modeId)
      mode.init({ seed: scenario.seed, params: scenario.params })
      simTimeSinceTelemetry = 0
      pendingTelemetry = mode.getTelemetry() // immediate readout on load
    },

    advance(realDeltaSec) {
      const active = mode
      if (!active) return
      clock.advance(realDeltaSec, (dt) => {
        active.step(dt)
        simTimeSinceTelemetry += dt
      })
      if (simTimeSinceTelemetry >= telemetryIntervalSec) {
        pendingTelemetry = active.getTelemetry()
        simTimeSinceTelemetry = 0
      }
    },

    getBuffers() {
      return mode ? mode.getBuffers() : null
    },

    consumeTelemetry() {
      const sample = pendingTelemetry
      pendingTelemetry = null
      return sample
    },

    dispose() {
      mode?.dispose()
      mode = null
      pendingTelemetry = null
    },
  }
}
