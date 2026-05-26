import type { ParticleBuffers, Telemetry } from '../../sim-core/types'
import type { Scenario } from '../../sim-core/scenario'

/**
 * Message protocol between the main thread and the physics worker. CPU-backed modes can run
 * their stepping off the main thread so a heavy sim never drops the UI to < 60fps. Particle
 * buffers are sent as transferable ArrayBuffers (zero-copy hand-off); the worker copies its
 * internal Float32 views into fresh buffers before transferring, so transferring one out never
 * detaches the buffer the mode reuses next step.
 */
export type MainToWorker =
  | { type: 'load'; scenario: Scenario }
  | { type: 'advance'; dt: number }
  | { type: 'dispose' }

export interface BuffersMessage {
  type: 'buffers'
  count: number
  radius: number
  positions: ArrayBuffer
  velocities: ArrayBuffer | null
  types: ArrayBuffer | null
}

export type WorkerToMain = BuffersMessage | { type: 'telemetry'; sample: Telemetry }

/** Copy a particle-buffer snapshot into a transferable message (+ the transfer list). */
export function packBuffers(buffers: ParticleBuffers): { message: BuffersMessage; transfer: ArrayBuffer[] } {
  const positions = buffers.positions.slice() // copy → safe to transfer without detaching the source
  const velocities = buffers.velocities ? buffers.velocities.slice() : null
  const types = buffers.types ? buffers.types.slice() : null
  const transfer: ArrayBuffer[] = [positions.buffer]
  if (velocities) transfer.push(velocities.buffer)
  if (types) transfer.push(types.buffer)
  return {
    message: {
      type: 'buffers',
      count: buffers.count,
      radius: buffers.radius,
      positions: positions.buffer,
      velocities: velocities ? velocities.buffer : null,
      types: types ? types.buffer : null,
    },
    transfer,
  }
}

/** Reconstruct typed-array views over a received buffers message. */
export function unpackBuffers(message: BuffersMessage): ParticleBuffers {
  const buffers: ParticleBuffers = {
    count: message.count,
    radius: message.radius,
    positions: new Float32Array(message.positions),
  }
  if (message.velocities) buffers.velocities = new Float32Array(message.velocities)
  if (message.types) buffers.types = new Uint8Array(message.types)
  return buffers
}
