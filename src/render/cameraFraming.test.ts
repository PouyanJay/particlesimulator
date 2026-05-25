import { describe, it, expect } from 'vitest'
import {
  cameraDistanceForContainer,
  defaultCameraPosition,
  zoomLimitsForContainer,
} from './cameraFraming'

const FOV = 45

describe('cameraDistanceForContainer', () => {
  it('is positive for a real container', () => {
    expect(cameraDistanceForContainer(2.5, FOV)).toBeGreaterThan(0)
  })

  it('scales linearly with container size (the standardized-framing property)', () => {
    // The whole point: a box twice as large is viewed from twice as far, so every mode
    // opens with the box filling the same fraction of the viewport.
    const small = cameraDistanceForContainer(3, FOV)
    const large = cameraDistanceForContainer(6, FOV)
    expect(large).toBeCloseTo(2 * small, 6)
  })

  it('keeps the distance/size ratio constant across the full range of mode box sizes', () => {
    const sizes = [2.5, 4, 6, 8, 10, 14]
    const ratios = sizes.map((s) => cameraDistanceForContainer(s, FOV) / s)
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 6)
  })

  it('moves closer for a wider field of view (more fits in frame)', () => {
    expect(cameraDistanceForContainer(5, 60)).toBeLessThan(cameraDistanceForContainer(5, 30))
  })

  it('places the whole bounding sphere inside the field of view with margin', () => {
    // The cube's bounding-sphere radius must subtend strictly less than half the FOV at the
    // chosen distance (strictly, because of the framing margin) — i.e. nothing is clipped.
    const size = 8
    const boundingRadius = (size / 2) * Math.sqrt(3)
    const d = cameraDistanceForContainer(size, FOV)
    const halfFov = (FOV * Math.PI) / 180 / 2
    expect(boundingRadius / d).toBeLessThan(Math.sin(halfFov))
  })
})

describe('defaultCameraPosition', () => {
  it('sits on the shared [1,1,1] viewing direction (equal, positive components)', () => {
    const [x, y, z] = defaultCameraPosition(6, FOV)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeCloseTo(x, 6)
    expect(z).toBeCloseTo(x, 6)
  })

  it('has length equal to the framing distance', () => {
    const size = 10
    const [x, y, z] = defaultCameraPosition(size, FOV)
    expect(Math.hypot(x, y, z)).toBeCloseTo(cameraDistanceForContainer(size, FOV), 6)
  })
})

describe('zoomLimitsForContainer', () => {
  it('brackets the default framing distance', () => {
    const size = 6
    const d = cameraDistanceForContainer(size, FOV)
    const { min, max } = zoomLimitsForContainer(size, FOV)
    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThan(d)
    expect(max).toBeGreaterThan(d)
  })

  it('scales its limits with container size', () => {
    const a = zoomLimitsForContainer(3, FOV)
    const b = zoomLimitsForContainer(6, FOV)
    expect(b.min).toBeCloseTo(2 * a.min, 6)
    expect(b.max).toBeCloseTo(2 * a.max, 6)
  })
})
