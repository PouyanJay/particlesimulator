import { createSimDriver, type SimDriver } from '../simDriver'
import { simRegistry } from '../../state/simRegistry'
import { createWorkerSimDriver } from './workerSimDriver'

// Physics-in-worker is opt-in via `?worker` while it's browser-verified: the proven
// main-thread path stays the default so the app is always ship-able. When enabled and workers
// are supported, CPU modes step off the main thread; any failure falls back transparently.
const WORKER_REQUESTED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('worker')

/**
 * Build the driver for CPU-backed modes: a worker-backed driver when requested and supported,
 * otherwise the in-process driver. Either satisfies the same `SimDriver` contract, so the
 * render loop doesn't care which it got.
 */
export function createCpuDriver(): SimDriver {
  if (WORKER_REQUESTED && typeof Worker !== 'undefined') {
    try {
      const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
      return createWorkerSimDriver(worker)
    } catch {
      // Fall through to the main-thread driver if the worker can't be constructed.
    }
  }
  return createSimDriver({ registry: simRegistry })
}
