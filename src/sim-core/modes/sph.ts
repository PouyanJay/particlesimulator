import { createSphField, type SphField } from '../physics/sphField'
import { reflectInBox } from '../physics/environment'
import { countParam, containerParam, gravityParam } from '../params/common'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

/**
 * Smoothed-Particle Hydrodynamics (SPH) fluid — weakly-compressible, the classic teaching model
 * for pressure, viscosity and incompressibility. Each particle carries mass; the field
 * (`sphField.ts`) estimates density from neighbours, a linear (Tait) equation of state turns
 * compression into pressure, and the symmetric pressure + viscosity forces (plus gravity) drive
 * the flow. A grid (cell size = smoothing radius) keeps the neighbour cost ~O(N).
 *
 * This is the **CPU reference** implementation per CLAUDE.md's GPU strategy: it is exhaustively
 * unit-tested (kernels, density vs brute-force, momentum conservation) so a later GPU/TSL port and
 * a screen-space fluid renderer can be validated against it. For now it renders through the shared
 * particle path (backend `cpu`); the liquid *surface* (SSFR) is a deliberate next increment, as the
 * roadmap advises shipping fluids incrementally.
 *
 * Integration is semi-implicit (symplectic) Euler, substepped internally — weakly-compressible SPH
 * is stiff, so the integrator never sees the coarse render-rate dt.
 */
export const sphSchema = {
  particleCount: countParam({ label: 'Particle Count', default: 1200, min: 64, max: 4000 }),
  containerSize: containerParam({ label: 'Box Size', default: 12, min: 6, max: 30, step: 1 }),
  gravity: gravityParam({ default: 9, max: 30, step: 0.5 }),
  stiffness: { type: 'number', label: 'Stiffness', default: 250, min: 10, max: 1000, step: 10 },
  viscosity: { type: 'number', label: 'Viscosity', default: 6, min: 0, max: 30, step: 0.5 },
  restDensity: { type: 'number', label: 'Rest Density', default: 1, min: 0.2, max: 4, step: 0.1 },
} as const

type Params = ParamValues<typeof sphSchema>

/** Initial fluid block side as a fraction of the box (a cube of liquid in the centre, which falls). */
const BLOCK_FRACTION = 0.5
/** Smoothing radius as a multiple of the initial particle spacing (≈30+ neighbours in 3-D). */
const H_PER_SPACING = 2
/** Fixed internal SPH timestep; `step` substeps the render-rate dt down to this for stability. */
const SPH_TIMESTEP = 0.002
/** Low wall restitution — a liquid should pool against walls, not bounce off them. */
const WALL_RESTITUTION = 0.2

/** Derived SPH scale for a count/box/rest-density: the single source for spacing, mass, h and
 *  render radius (so the mode and any density inspection agree on the same numbers). */
export interface SphScale {
  spacing: number
  mass: number
  smoothingRadius: number
  radius: number
}
export function deriveSphScale(count: number, containerSize: number, restDensity: number): SphScale {
  const perSide = Math.max(1, Math.ceil(Math.cbrt(count)))
  const spacing = (containerSize * BLOCK_FRACTION) / perSide
  return {
    spacing,
    mass: restDensity * spacing ** 3, // ρ₀·spacing³ ⇒ initial lattice density ≈ rest density
    smoothingRadius: H_PER_SPACING * spacing,
    radius: 0.5 * spacing,
  }
}

export function createSphFluidMode(): SimMode<typeof sphSchema> {
  let count = 0
  let radius = 0
  let halfBound = 0
  let gravity = 0
  let mass = 1

  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let density = new Float64Array(0)
  let accel = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)
  let field: SphField | null = null

  function init(ctx: SimContext<typeof sphSchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    gravity = p.gravity

    // Derive the particle spacing/mass/h from a cubic block filling BLOCK_FRACTION of the box (the
    // shared `deriveSphScale`, so density inspection in tests uses the identical numbers).
    const perSide = Math.max(1, Math.ceil(Math.cbrt(count)))
    const scale = deriveSphScale(count, p.containerSize, p.restDensity)
    const spacing = scale.spacing
    const h = scale.smoothingRadius
    mass = scale.mass
    radius = scale.radius // render size: particles slightly overlap and read as a body of fluid
    halfBound = p.containerSize / 2 - radius

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3)
    density = new Float64Array(count)
    accel = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
    field = createSphField({
      mass,
      restDensity: p.restDensity,
      stiffness: p.stiffness,
      viscosity: p.viscosity,
      smoothingRadius: h,
    })

    // Seed the first `count` cells of a centred perSide³ lattice (a cube of liquid at the origin).
    const offset = ((perSide - 1) * spacing) / 2
    for (let i = 0; i < count; i++) {
      const ix = i % perSide
      const iy = Math.floor(i / perSide) % perSide
      const iz = Math.floor(i / (perSide * perSide))
      const o = i * 3
      positions[o] = ix * spacing - offset
      positions[o + 1] = iy * spacing - offset
      positions[o + 2] = iz * spacing - offset
    }
  }

  function step(dt: number): void {
    if (!field || count === 0 || dt <= 0) return
    const subSteps = Math.max(1, Math.ceil(dt / SPH_TIMESTEP))
    const subDt = dt / subSteps
    for (let s = 0; s < subSteps; s++) {
      field.computeDensities(positions, count, density)
      field.computeAccelerations(positions, velocities, density, count, accel)
      // Semi-implicit (symplectic) Euler with external gravity folded into −Y.
      for (let i = 0; i < count; i++) {
        const o = i * 3
        velocities[o] += accel[o] * subDt
        velocities[o + 1] += (accel[o + 1] - gravity) * subDt
        velocities[o + 2] += accel[o + 2] * subDt
        positions[o] += velocities[o] * subDt
        positions[o + 1] += velocities[o + 1] * subDt
        positions[o + 2] += velocities[o + 2] * subDt
      }
      reflectInBox(positions, velocities, count, halfBound, WALL_RESTITUTION, mass)
    }
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < renderPositions.length; i++) {
      renderPositions[i] = positions[i]
      renderVelocities[i] = velocities[i]
    }
    return { count, positions: renderPositions, velocities: renderVelocities, radius }
  }

  function getTelemetry(): Telemetry {
    let speedSum = 0
    let keSum = 0
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const speedSq = velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2
      speedSum += Math.sqrt(speedSq)
      keSum += speedSq
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0.5 * mass * keSum,
      // Gravity does work and viscosity dissipates — total mechanical energy isn't conserved.
      inelastic: true,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    density = new Float64Array(0)
    accel = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    field = null
    count = 0
  }

  return {
    id: 'sph-fluid',
    label: 'Fluid (SPH)',
    backend: 'cpu',
    paramSchema: sphSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
