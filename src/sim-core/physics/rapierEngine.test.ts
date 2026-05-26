import { describe, it, expect, beforeAll } from 'vitest'
import { ensureRapierReady, getRapier, isRapierReady } from './rapierEngine'

describe('rapierEngine — lazy Rapier loader', () => {
  it('reports not-ready and throws from getRapier before initialisation', () => {
    // Note: ordering matters — this runs before ensureRapierReady() below resolves the singleton.
    if (!isRapierReady()) {
      expect(() => getRapier()).toThrow(/init/i)
    }
  })

  describe('after ensureRapierReady()', () => {
    beforeAll(async () => {
      await ensureRapierReady()
    })

    it('resolves and exposes the Rapier namespace', () => {
      expect(isRapierReady()).toBe(true)
      const RAPIER = getRapier()
      expect(typeof RAPIER.World).toBe('function')
      expect(typeof RAPIER.RigidBodyDesc).toBe('function')
      expect(typeof RAPIER.ColliderDesc).toBe('function')
    })

    it('memoises: repeated calls return the same resolved promise/namespace', async () => {
      const a = ensureRapierReady()
      const b = ensureRapierReady()
      expect(a).toBe(b)
      await a
      expect(getRapier()).toBe(getRapier())
    })

    it('can build and step a world (smoke test of the loaded engine)', () => {
      const RAPIER = getRapier()
      const world = new RAPIER.World({ x: 0, y: -10, z: 0 })
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0))
      world.createCollider(RAPIER.ColliderDesc.ball(0.5), body)
      const y0 = body.translation().y
      for (let i = 0; i < 30; i++) world.step()
      expect(body.translation().y).toBeLessThan(y0) // fell under gravity
      world.free()
    })
  })
})
