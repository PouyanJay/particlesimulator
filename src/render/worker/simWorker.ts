/// <reference lib="webworker" />
import { createSimDriver } from '../simDriver'
import { simRegistry } from '../../state/simRegistry'
import { packBuffers, type MainToWorker } from './workerProtocol'

/**
 * Physics worker entry. Hosts a `SimDriver` over the (pure, three-free) sim registry and steps
 * it off the main thread, streaming particle buffers + telemetry back. The registry pulls only
 * sim-core, so the worker bundle carries no three.js/React. GPU-resident modes never reach here
 * — they render on the main thread via <GpuNbody>.
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope
const driver = createSimDriver({ registry: simRegistry })

function postFrame(): void {
  const buffers = driver.getBuffers()
  if (buffers) {
    const { message, transfer } = packBuffers(buffers)
    ctx.postMessage(message, transfer)
  }
  const sample = driver.consumeTelemetry()
  if (sample) ctx.postMessage({ type: 'telemetry', sample })
}

ctx.onmessage = (event: MessageEvent<MainToWorker>) => {
  const message = event.data
  switch (message.type) {
    case 'load':
      driver.load(message.scenario)
      postFrame()
      break
    case 'advance':
      driver.advance(message.dt)
      postFrame()
      break
    case 'dispose':
      driver.dispose()
      break
  }
}
