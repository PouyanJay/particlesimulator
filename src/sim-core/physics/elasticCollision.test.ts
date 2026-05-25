import { describe, it, expect } from 'vitest'
import { resolveElasticCollision } from './elasticCollision'
import { add, scale, lengthSq, type Vec3 } from '../math/vec3'

const momentum = (m1: number, v1: Vec3, m2: number, v2: Vec3): Vec3 =>
  add(scale(v1, m1), scale(v2, m2))

const kineticEnergy = (m1: number, v1: Vec3, m2: number, v2: Vec3): number =>
  0.5 * m1 * lengthSq(v1) + 0.5 * m2 * lengthSq(v2)

describe('resolveElasticCollision', () => {
  it('conserves total momentum (equal masses, head-on)', () => {
    const p1: Vec3 = [0, 0, 0]
    const p2: Vec3 = [1, 0, 0]
    const v1: Vec3 = [2, 0, 0] // moving right, toward p2
    const v2: Vec3 = [-1, 0, 0] // moving left, toward p1
    const [n1, n2] = resolveElasticCollision(p1, v1, 1, p2, v2, 1, 1)
    expect(momentum(1, n1, 1, n2)).toEqual(momentum(1, v1, 1, v2))
  })

  it('exchanges velocities for an equal-mass head-on elastic collision', () => {
    const [n1, n2] = resolveElasticCollision([0, 0, 0], [2, 0, 0], 1, [1, 0, 0], [-1, 0, 0], 1, 1)
    expect(n1[0]).toBeCloseTo(-1, 10)
    expect(n2[0]).toBeCloseTo(2, 10)
  })

  it('conserves kinetic energy when restitution = 1 (unequal masses, oblique)', () => {
    const p1: Vec3 = [0, 0, 0]
    const p2: Vec3 = [1, 1, 0]
    const v1: Vec3 = [1.5, 0.3, -0.2]
    const v2: Vec3 = [-0.4, -1.1, 0.6]
    const m1 = 1
    const m2 = 3
    const [n1, n2] = resolveElasticCollision(p1, v1, m1, p2, v2, m2, 1)
    expect(kineticEnergy(m1, n1, m2, n2)).toBeCloseTo(kineticEnergy(m1, v1, m2, v2), 10)
    expect(momentum(m1, n1, m2, n2)[0]).toBeCloseTo(momentum(m1, v1, m2, v2)[0], 10)
    expect(momentum(m1, n1, m2, n2)[1]).toBeCloseTo(momentum(m1, v1, m2, v2)[1], 10)
    expect(momentum(m1, n1, m2, n2)[2]).toBeCloseTo(momentum(m1, v1, m2, v2)[2], 10)
  })

  it('removes kinetic energy when restitution < 1 but still conserves momentum', () => {
    const p1: Vec3 = [0, 0, 0]
    const p2: Vec3 = [1, 0, 0]
    const v1: Vec3 = [2, 0, 0]
    const v2: Vec3 = [-1, 0, 0]
    const [n1, n2] = resolveElasticCollision(p1, v1, 1, p2, v2, 1, 0.5)
    const before = kineticEnergy(1, v1, 1, v2)
    const after = kineticEnergy(1, n1, 1, n2)
    expect(after).toBeLessThan(before)
    expect(momentum(1, n1, 1, n2)[0]).toBeCloseTo(momentum(1, v1, 1, v2)[0], 10)
  })

  it('leaves separating particles unchanged (no spurious impulse)', () => {
    // p1 left of p2 but both moving apart along x.
    const v1: Vec3 = [-1, 0, 0]
    const v2: Vec3 = [3, 0, 0]
    const [n1, n2] = resolveElasticCollision([0, 0, 0], v1, 1, [1, 0, 0], v2, 1, 1)
    expect(n1).toEqual(v1)
    expect(n2).toEqual(v2)
  })
})
