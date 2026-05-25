import { describe, it, expect } from 'vitest'
import { seedNbodyDisk } from './nbodySeed'

describe('seedNbodyDisk', () => {
  it('fills position and velocity arrays for every body', () => {
    const pos = new Float32Array(30)
    const vel = new Float32Array(30)
    seedNbodyDisk(1, 10, 8, 0.6, pos, vel)
    // Positions within the seeding disk; not all zero.
    expect(pos.some((v) => v !== 0)).toBe(true)
    expect(vel.some((v) => v !== 0)).toBe(true)
  })

  it('seeds a flattened, spinning disk (y compressed; tangential velocity about Y)', () => {
    const count = 200
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const containerSize = 8
    const rotation = 0.6
    seedNbodyDisk(42, count, containerSize, rotation, pos, vel)
    const r = containerSize * 0.25
    for (let i = 0; i < count; i++) {
      const o = i * 3
      expect(Math.abs(pos[o])).toBeLessThanOrEqual(r + 1e-5) // x in [-r, r]
      expect(Math.abs(pos[o + 1])).toBeLessThanOrEqual(r * 0.3 + 1e-5) // y compressed
      // Rigid rotation about Y: v = (w·z, 0, -w·x).
      expect(vel[o]).toBeCloseTo(rotation * pos[o + 2], 5)
      expect(vel[o + 1]).toBe(0)
      expect(vel[o + 2]).toBeCloseTo(-rotation * pos[o], 5)
    }
  })

  it('is deterministic: same seed yields identical arrays', () => {
    const a = new Float32Array(60)
    const b = new Float32Array(60)
    const av = new Float32Array(60)
    const bv = new Float32Array(60)
    seedNbodyDisk(7, 20, 8, 0.6, a, av)
    seedNbodyDisk(7, 20, 8, 0.6, b, bv)
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(av)).toEqual(Array.from(bv))
  })

  it('produces different layouts for different seeds', () => {
    const a = new Float32Array(60)
    const b = new Float32Array(60)
    const v = new Float32Array(60)
    seedNbodyDisk(1, 20, 8, 0.6, a, v)
    seedNbodyDisk(2, 20, 8, 0.6, b, v)
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })
})
