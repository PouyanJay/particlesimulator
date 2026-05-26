import { accumulateSpringForces } from '../physics/springForce'
import { buildSpringNetwork, type SpringNetwork } from './springNetwork'
import { reflectInBox } from '../physics/environment'
import { countParam, containerParam, gravityParam, sceneNumberParam } from '../params/common'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

/**
 * Spring-mass systems — point masses connected by damped Hooke springs (`springForce.ts`)
 * arranged into a rope, cloth sheet, or 3-D lattice by `springNetwork.ts`. Motion is driven
 * by gravity acting on the network while pinned nodes hold it up, so a cloth pinned along its
 * top edge drapes and swings, a rope hangs as a catenary, and a lattice wobbles — demonstrating
 * Hooke's law, oscillation, damping, and wave propagation through a coupled system.
 *
 * Integration is **semi-implicit (symplectic) Euler** — the right choice for stiff springs
 * (RK4 is *worse* here; see CLAUDE.md). Because the spring damping term is velocity-dependent
 * the step is assembled directly (the shared position-only `AccelFn` integrators can't carry
 * it). Springs are stiff, so the incoming frame dt is split into fixed-size sub-steps to keep
 * the integrator inside its stability window regardless of the render-rate dt the driver feeds.
 */
export const springMassSchema = {
  cols: countParam({ label: 'Columns (X)', default: 16, min: 1, max: 40 }),
  rows: countParam({ label: 'Rows (Y)', default: 16, min: 1, max: 40 }),
  layers: countParam({ label: 'Layers (Z)', default: 1, min: 1, max: 12 }),
  spacing: sceneNumberParam({ label: 'Spacing', default: 0.8, min: 0.2, max: 3, step: 0.1 }),
  containerSize: containerParam({ label: 'Box Size', default: 26, min: 8, max: 60, step: 1 }),
  gravity: gravityParam({ default: 6, max: 20, step: 0.5 }),
  stiffness: { type: 'number', label: 'Stiffness', default: 120, min: 1, max: 400, step: 1 },
  damping: { type: 'number', label: 'Damping', default: 0.8, min: 0, max: 5, step: 0.1 },
  restitution: { type: 'number', label: 'Wall Bounce', default: 0.3, min: 0, max: 1, step: 0.05 },
  pinTop: { type: 'boolean', label: 'Pin Top Edge', default: true },
  shear: { type: 'boolean', label: 'Shear Springs', default: true },
  bend: { type: 'boolean', label: 'Bend Springs', default: true },
} as const

type Params = ParamValues<typeof springMassSchema>

const PARTICLE_MASS = 1 // reduced units: unit mass per node.

/**
 * Fixed internal integration step. Springs of stiffness k have characteristic angular
 * frequency ω = √(k/m); semi-implicit Euler is stable for ω·dt ≲ 2. At the schema's maximum
 * stiffness (with the extra coupling from shear/bend springs) the stiffest mode sits well
 * inside that window at this dt, with energy drift bounded (symplectic). `step` splits the
 * incoming frame dt into ⌈dt / SPRING_TIMESTEP⌉ equal sub-steps.
 */
const SPRING_TIMESTEP = 0.002

/** Render radius as a fraction of node spacing — small enough that springs read as the structure. */
const RADIUS_PER_SPACING = 0.18

export function createSpringMassMode(): SimMode<typeof springMassSchema> {
  let count = 0
  let radius = 0
  let halfBound = 0
  let gravity = 0
  let stiffness = 0
  let damping = 0
  let restitution = 1

  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let force = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  let network: SpringNetwork | null = null

  function init(ctx: SimContext<typeof springMassSchema>): void {
    const p: Params = ctx.params
    gravity = p.gravity
    stiffness = p.stiffness
    damping = p.damping
    restitution = p.restitution
    radius = RADIUS_PER_SPACING * p.spacing
    halfBound = p.containerSize / 2 - radius

    network = buildSpringNetwork({
      cols: p.cols,
      rows: p.rows,
      layers: p.layers,
      spacing: p.spacing,
      shear: p.shear,
      bend: p.bend,
      pinTop: p.pinTop,
    })
    count = network.nodeCount

    positions = Float64Array.from(network.positions) // mutable working copy (network is the rest state)
    velocities = new Float64Array(count * 3)
    force = new Float64Array(count * 3)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)
  }

  function step(dt: number): void {
    if (!network || count === 0 || dt <= 0) return
    const { edges, restLengths, pinned } = network
    const subSteps = Math.max(1, Math.ceil(dt / SPRING_TIMESTEP))
    const subDt = dt / subSteps

    for (let s = 0; s < subSteps; s++) {
      accumulateSpringForces(positions, velocities, edges, restLengths, stiffness, damping, force)
      // Semi-implicit (symplectic) Euler: v += a·dt, then x += v·dt. Pinned nodes are held
      // fixed (they act as immovable supports — the source of the gravitational driving).
      for (let i = 0; i < count; i++) {
        if (pinned[i]) continue
        const o = i * 3
        velocities[o] += (force[o] / PARTICLE_MASS) * subDt
        velocities[o + 1] += (force[o + 1] / PARTICLE_MASS - gravity) * subDt
        velocities[o + 2] += (force[o + 2] / PARTICLE_MASS) * subDt
        positions[o] += velocities[o] * subDt
        positions[o + 1] += velocities[o + 1] * subDt
        positions[o + 2] += velocities[o + 2] * subDt
      }
      reflectInBox(positions, velocities, count, halfBound, restitution, PARTICLE_MASS)
    }
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < renderPositions.length; i++) {
      renderPositions[i] = positions[i]
      renderVelocities[i] = velocities[i]
    }
    return {
      count,
      positions: renderPositions,
      velocities: renderVelocities,
      edges: network?.edges,
      radius,
    }
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
      kineticEnergy: 0.5 * PARTICLE_MASS * keSum,
      // Gravity does work, axial damping dissipates, and a lossy wall (restitution < 1) bleeds
      // energy — any of these means total mechanical energy isn't conserved this run.
      inelastic: gravity > 0 || damping > 0 || restitution < 1,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    force = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    network = null
    count = 0
  }

  return {
    id: 'spring-mass',
    label: 'Spring-Mass / Cloth',
    backend: 'cpu',
    paramSchema: springMassSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
