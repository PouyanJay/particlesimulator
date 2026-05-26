import { describe, it, expect } from 'vitest'
import { createSphField, type SphFieldParams } from './sphField'
import { poly6 } from './sphKernels'
import { createRng } from '../rng'

const PARAMS: SphFieldParams = {
  mass: 1,
  restDensity: 1,
  stiffness: 5,
  viscosity: 1,
  smoothingRadius: 1.5,
}

/** Brute-force O(N²) density (incl. self), the ground truth the grid must match. */
function bruteDensity(pos: Float64Array, count: number, mass: number, h: number): Float64Array {
  const d = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    let sum = poly6(0, h) // self
    for (let j = 0; j < count; j++) {
      if (j === i) continue
      const r = Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2])
      sum += poly6(r, h)
    }
    d[i] = mass * sum
  }
  return d
}

function randomCloud(seed: number, count: number, extent: number): Float64Array {
  const rng = createRng(seed)
  const pos = new Float64Array(count * 3)
  for (let i = 0; i < count * 3; i++) pos[i] = (rng() * 2 - 1) * extent
  return pos
}

describe('SPH field — grid-accelerated density & forces', () => {
  it('computes densities equal to the brute-force O(N²) sum (grid broadphase is exact)', () => {
    const field = createSphField(PARAMS)
    const count = 60
    const pos = randomCloud(1, count, 2)
    const density = new Float64Array(count)
    field.computeDensities(pos, count, density)
    const brute = bruteDensity(pos, count, PARAMS.mass, PARAMS.smoothingRadius)
    for (let i = 0; i < count; i++) expect(density[i]).toBeCloseTo(brute[i], 9)
  })

  it('gives an isolated particle only its finite self-density', () => {
    const field = createSphField(PARAMS)
    const pos = new Float64Array([0, 0, 0])
    const density = new Float64Array(1)
    field.computeDensities(pos, 1, density)
    expect(density[0]).toBeCloseTo(PARAMS.mass * poly6(0, PARAMS.smoothingRadius), 12)
  })

  it('reports higher density where particles are packed closer', () => {
    const field = createSphField(PARAMS)
    const close = new Float64Array([0, 0, 0, 0.3, 0, 0, -0.3, 0, 0])
    const far = new Float64Array([0, 0, 0, 1.2, 0, 0, -1.2, 0, 0])
    const dC = new Float64Array(3)
    const dF = new Float64Array(3)
    field.computeDensities(close, 3, dC)
    field.computeDensities(far, 3, dF)
    expect(dC[0]).toBeGreaterThan(dF[0])
  })

  it('conserves momentum: internal pressure + viscosity forces sum to zero', () => {
    const field = createSphField(PARAMS)
    const count = 50
    const pos = randomCloud(2, count, 1.5) // overlapping ⇒ over-dense ⇒ real pressure forces
    const rng = createRng(3)
    const vel = new Float64Array(count * 3)
    for (let i = 0; i < count * 3; i++) vel[i] = rng() * 2 - 1
    const density = new Float64Array(count)
    const accel = new Float64Array(count * 3)
    field.computeDensities(pos, count, density)
    field.computeAccelerations(pos, vel, density, count, accel)
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < count; i++) {
      sx += accel[i * 3]
      sy += accel[i * 3 + 1]
      sz += accel[i * 3 + 2]
    }
    // Equal masses ⇒ Σ a = Σ f / m must vanish for purely internal (paired) forces.
    expect(sx).toBeCloseTo(0, 8)
    expect(sy).toBeCloseTo(0, 8)
    expect(sz).toBeCloseTo(0, 8)
  })

  it('pressure pushes over-dense (compressed) particles apart', () => {
    // Low rest density so two nearby particles are genuinely over-dense ⇒ positive pressure.
    const restDensity = 0.5
    const field = createSphField({ ...PARAMS, restDensity })
    const pos = new Float64Array([-0.2, 0, 0, 0.2, 0, 0])
    const vel = new Float64Array(6)
    const density = new Float64Array(2)
    const accel = new Float64Array(6)
    field.computeDensities(pos, 2, density)
    expect(density[0]).toBeGreaterThan(restDensity) // genuinely compressed
    field.computeAccelerations(pos, vel, density, 2, accel)
    expect(accel[0]).toBeLessThan(0) // left particle pushed further left (apart)
    expect(accel[3]).toBeGreaterThan(0) // right particle pushed further right
  })

  it('viscosity damps relative motion (force opposes velocity difference)', () => {
    // At rest density ⇒ no pressure; isolate viscosity. Use restDensity tuned so P≈0.
    const field = createSphField({ ...PARAMS, stiffness: 0 }) // stiffness 0 ⇒ pure viscosity
    const pos = new Float64Array([-0.5, 0, 0, 0.5, 0, 0])
    const vel = new Float64Array([0, 1, 0, 0, -1, 0]) // shearing in y
    const density = new Float64Array(2)
    const accel = new Float64Array(6)
    field.computeDensities(pos, 2, density)
    field.computeAccelerations(pos, vel, density, 2, accel)
    // Particle 0 (v_y=+1) should be decelerated toward particle 1's v_y=−1 ⇒ a_y < 0.
    expect(accel[1]).toBeLessThan(0)
    expect(accel[4]).toBeGreaterThan(0)
  })
})
