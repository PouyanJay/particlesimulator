import { describe, it, expect } from 'vitest'
import { packBuffers, unpackBuffers } from './workerProtocol'
import type { ParticleBuffers } from '../../sim-core/types'

describe('worker buffer protocol', () => {
  it('packs and unpacks positions, velocities, and types round-trip', () => {
    const source: ParticleBuffers = {
      count: 2,
      radius: 0.1,
      positions: new Float32Array([0, 1, 2, 3, 4, 5]),
      velocities: new Float32Array([6, 7, 8, 9, 10, 11]),
      types: new Uint8Array([0, 1]),
    }
    const { message, transfer } = packBuffers(source)
    const restored = unpackBuffers(message)
    expect(restored.count).toBe(2)
    expect(restored.radius).toBeCloseTo(0.1)
    expect(Array.from(restored.positions)).toEqual([0, 1, 2, 3, 4, 5])
    expect(Array.from(restored.velocities!)).toEqual([6, 7, 8, 9, 10, 11])
    expect(Array.from(restored.types!)).toEqual([0, 1])
    // positions + velocities + types buffers are all listed for transfer
    expect(transfer).toHaveLength(3)
  })

  it('copies rather than aliases the source (transferring out must not detach the mode buffer)', () => {
    const positions = new Float32Array([1, 2, 3])
    const source: ParticleBuffers = { count: 1, radius: 1, positions }
    const { message } = packBuffers(source)
    expect(message.positions).not.toBe(positions.buffer) // a copy, not the original
    expect(positions.byteLength).toBe(12) // source not detached
  })

  it('omits velocities/types when absent', () => {
    const { message, transfer } = packBuffers({ count: 1, radius: 1, positions: new Float32Array([0, 0, 0]) })
    expect(message.velocities).toBeNull()
    expect(message.types).toBeNull()
    expect(transfer).toHaveLength(1)
    const restored = unpackBuffers(message)
    expect(restored.velocities).toBeUndefined()
    expect(restored.types).toBeUndefined()
  })
})
