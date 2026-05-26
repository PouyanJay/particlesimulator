import type { SimDriver, Scenario } from '../simDriver'
import type { ParticleBuffers, Telemetry } from '../../sim-core/types'
import { unpackBuffers, type WorkerToMain } from './workerProtocol'

/** The slice of the Worker API this client uses (injectable so it's testable without a real worker). */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((event: MessageEvent) => void) | null
}

/**
 * A `SimDriver` whose stepping happens in a worker. `advance` is fire-and-forget: it tells the
 * worker to step and the worker streams back the latest particle buffers and telemetry, which
 * `getBuffers`/`consumeTelemetry` surface to the render loop. Buffers lag by a frame or two —
 * imperceptible, and the point is that the main thread never blocks on physics.
 */
export function createWorkerSimDriver(worker: WorkerLike): SimDriver {
  let latest: ParticleBuffers | null = null
  let pendingTelemetry: Telemetry | null = null

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data as WorkerToMain
    if (message.type === 'buffers') latest = unpackBuffers(message)
    else if (message.type === 'telemetry') pendingTelemetry = message.sample
  }

  return {
    load(scenario: Scenario) {
      latest = null
      pendingTelemetry = null
      worker.postMessage({ type: 'load', scenario })
    },
    advance(realDeltaSec: number) {
      worker.postMessage({ type: 'advance', dt: realDeltaSec })
    },
    getBuffers() {
      return latest
    },
    consumeTelemetry() {
      const sample = pendingTelemetry
      pendingTelemetry = null
      return sample
    },
    dispose() {
      worker.postMessage({ type: 'dispose' })
      worker.terminate()
    },
  }
}
