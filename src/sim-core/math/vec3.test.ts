import { describe, it, expect } from 'vitest'
import { add, sub, scale, dot, lengthSq, length, type Vec3 } from './vec3'

describe('vec3', () => {
  const a: Vec3 = [1, 2, 3]
  const b: Vec3 = [4, -5, 6]

  it('add returns the component-wise sum', () => {
    expect(add(a, b)).toEqual([5, -3, 9])
  })

  it('sub returns the component-wise difference', () => {
    expect(sub(a, b)).toEqual([-3, 7, -3])
  })

  it('scale multiplies every component by a scalar', () => {
    expect(scale(a, 2)).toEqual([2, 4, 6])
  })

  it('dot returns the scalar product', () => {
    expect(dot(a, b)).toBe(1 * 4 + 2 * -5 + 3 * 6) // 4 - 10 + 18 = 12
  })

  it('lengthSq returns the squared magnitude (no sqrt)', () => {
    expect(lengthSq(a)).toBe(14)
  })

  it('length returns the Euclidean magnitude', () => {
    expect(length([3, 4, 0])).toBe(5)
  })

  it('does not mutate its inputs', () => {
    add(a, b)
    sub(a, b)
    scale(a, 3)
    expect(a).toEqual([1, 2, 3])
    expect(b).toEqual([4, -5, 6])
  })
})
