import { describe, it, expect, beforeEach } from 'vitest'
import { applyScenario } from './applyScenario'
import { useParamStore } from '../state/paramStore'
import { registerCamera, consumePendingCameraPose, type CameraApi } from './cameraBridge'
import type { Scenario } from '../sim-core/scenario'

const camera: Scenario['camera'] = { position: [1, 2, 3], target: [0, 0, 0] }

function fakeCamera() {
  const applied: NonNullable<Scenario['camera']>[] = []
  const api: CameraApi = {
    getPose: () => ({ position: [0, 0, 0], target: [0, 0, 0] }),
    setPose: (pose) => applied.push(pose),
  }
  return { api, applied }
}

beforeEach(() => {
  registerCamera(null)
  consumePendingCameraPose() // clear any queued pose
  useParamStore.setState({
    modeId: 'elastic-gas',
    seed: 1,
    params: { particleCount: 100 },
    substanceId: 'reduced',
    view: '3d',
    isPlaying: true,
  })
})

describe('applyScenario', () => {
  it('loads the scenario into the store', () => {
    applyScenario({ modeId: 'boids', seed: 9, params: { particleCount: 40 }, view: '2d' })
    const s = useParamStore.getState()
    expect(s.modeId).toBe('boids')
    expect(s.params.particleCount).toBe(40)
    expect(s.view).toBe('2d')
  })

  it('applies the camera immediately when mode and view are unchanged', () => {
    const { api, applied } = fakeCamera()
    registerCamera(api)
    applyScenario({ modeId: 'elastic-gas', seed: 2, params: { particleCount: 100 }, view: '3d', camera })
    expect(applied).toEqual([camera]) // applied now
    expect(consumePendingCameraPose()).toBeNull() // not queued
  })

  it('queues the camera when the mode changes (so it overrides the rig re-framing)', () => {
    const { api, applied } = fakeCamera()
    registerCamera(api)
    applyScenario({ modeId: 'boids', seed: 2, params: { particleCount: 40 }, view: '3d', camera })
    expect(applied).toEqual([]) // not applied directly
    expect(consumePendingCameraPose()).toEqual(camera) // queued for the rig
  })

  it('queues the camera when only the view changes', () => {
    applyScenario({ modeId: 'elastic-gas', seed: 1, params: { particleCount: 100 }, view: '2d', camera })
    expect(consumePendingCameraPose()).toEqual(camera)
  })

  it('does nothing camera-wise when the scenario has no camera', () => {
    const { api, applied } = fakeCamera()
    registerCamera(api)
    applyScenario({ modeId: 'boids', seed: 3, params: { particleCount: 40 } })
    expect(applied).toEqual([])
    expect(consumePendingCameraPose()).toBeNull()
  })
})
