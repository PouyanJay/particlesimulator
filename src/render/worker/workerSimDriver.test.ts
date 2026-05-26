import { describe, it, expect, vi } from 'vitest'
import { createWorkerSimDriver, type WorkerLike } from './workerSimDriver'
import { packBuffers, type WorkerToMain } from './workerProtocol'
import type { ParticleBuffers, Telemetry } from '../../sim-core/types'

function fakeWorker() {
  const posted: { message: unknown; transfer?: Transferable[] }[] = []
  const worker: WorkerLike = {
    onmessage: null,
    postMessage: (message, transfer) => posted.push({ message, transfer }),
    terminate: vi.fn(),
  }
  // Helper to simulate a message arriving from the worker.
  const emit = (data: WorkerToMain) => worker.onmessage?.({ data } as MessageEvent)
  return { worker, posted, emit }
}

describe('workerSimDriver (client)', () => {
  it('forwards load/advance/dispose as protocol messages', () => {
    const { worker, posted } = fakeWorker()
    const driver = createWorkerSimDriver(worker)
    driver.load({ modeId: 'boids', seed: 1, params: { particleCount: 10 } })
    driver.advance(0.016)
    driver.dispose()
    expect(posted.map((p) => (p.message as { type: string }).type)).toEqual(['load', 'advance', 'dispose'])
    expect((posted[1].message as { dt: number }).dt).toBeCloseTo(0.016)
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('surfaces the latest buffers streamed back from the worker', () => {
    const { worker, emit } = fakeWorker()
    const driver = createWorkerSimDriver(worker)
    expect(driver.getBuffers()).toBeNull()

    const buffers: ParticleBuffers = { count: 1, radius: 0.2, positions: new Float32Array([1, 2, 3]) }
    emit(packBuffers(buffers).message)

    const received = driver.getBuffers()
    expect(received?.count).toBe(1)
    expect(Array.from(received!.positions)).toEqual([1, 2, 3])
  })

  it('hands telemetry over exactly once (consume semantics)', () => {
    const { worker, emit } = fakeWorker()
    const driver = createWorkerSimDriver(worker)
    const sample: Telemetry = { particleCount: 1, averageSpeed: 0.5, kineticEnergy: 1 }
    emit({ type: 'telemetry', sample })
    expect(driver.consumeTelemetry()).toEqual(sample)
    expect(driver.consumeTelemetry()).toBeNull()
  })

  it('clears stale buffers/telemetry on reload', () => {
    const { worker, emit } = fakeWorker()
    const driver = createWorkerSimDriver(worker)
    emit(packBuffers({ count: 1, radius: 1, positions: new Float32Array([9, 9, 9]) }).message)
    driver.load({ modeId: 'boids', seed: 2, params: {} })
    expect(driver.getBuffers()).toBeNull()
    expect(driver.consumeTelemetry()).toBeNull()
  })
})
