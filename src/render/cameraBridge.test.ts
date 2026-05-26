import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerCamera,
  captureCameraPose,
  applyCameraPose,
  queueCameraPose,
  consumePendingCameraPose,
  type CameraApi,
} from './cameraBridge'
import type { CameraPose } from '../sim-core/scenario'

function makeApi(): CameraApi & { applied: CameraPose[]; pose: CameraPose } {
  const pose: CameraPose = { position: [1, 2, 3], target: [0, 0, 0] }
  return {
    pose,
    applied: [],
    getPose() {
      return this.pose
    },
    setPose(p) {
      this.applied.push(p)
    },
  }
}

beforeEach(() => {
  registerCamera(null)
  consumePendingCameraPose()
})

describe('cameraBridge', () => {
  it('returns null when no camera is registered', () => {
    expect(captureCameraPose()).toBeNull()
  })

  it('captures the live pose via the registered camera', () => {
    const api = makeApi()
    registerCamera(api)
    expect(captureCameraPose()).toEqual({ position: [1, 2, 3], target: [0, 0, 0] })
  })

  it('applies a pose immediately when a camera is registered', () => {
    const api = makeApi()
    registerCamera(api)
    const pose: CameraPose = { position: [4, 5, 6], target: [1, 1, 1] }
    applyCameraPose(pose)
    expect(api.applied).toEqual([pose])
  })

  it('queues a pose when no camera is registered yet, for the rig to consume on mount', () => {
    const pose: CameraPose = { position: [9, 9, 9], target: [0, 0, 0] }
    applyCameraPose(pose) // no camera registered → becomes pending
    expect(consumePendingCameraPose()).toEqual(pose)
    expect(consumePendingCameraPose()).toBeNull() // consumed once
  })

  it('queueCameraPose stores a pose for the next rig sync', () => {
    const pose: CameraPose = { position: [7, 0, 0], target: [0, 0, 0] }
    queueCameraPose(pose)
    expect(consumePendingCameraPose()).toEqual(pose)
  })
})
