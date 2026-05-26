import { solveDistanceConstraints } from '../physics/xpbdConstraints'
import { buildSpringNetwork, type SpringNetwork } from './springNetwork'
import { countParam, containerParam, gravityParam, sceneNumberParam } from '../params/common'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

/**
 * Cloth & soft bodies via XPBD (Extended Position-Based Dynamics). Same node grid as the
 * spring-mass mode (`buildSpringNetwork` — rope / cloth sheet / 3-D lattice with structural,
 * shear and bend connections), but the connections are **distance constraints** solved by
 * position projection (`xpbdConstraints.ts`) instead of Hooke forces. The pedagogical contrast:
 * the spring-mass mode integrates forces and must keep the timestep small for stiff springs,
 * whereas XPBD is **unconditionally stable** at any stiffness — even rigid (compliance 0) cloth
 * under heavy gravity with a single iteration cannot explode, because positions are projected,
 * not accelerated.
 *
 * Per substep (the standard XPBD loop, Müller et al.):
 *   1. predict — integrate gravity into velocity, advance positions by v·dt;
 *   2. project — reset the per-edge Lagrange multipliers, then sweep the distance constraints
 *      `iterations` times (more iterations / lower compliance ⇒ stiffer, closer to rigid);
 *   3. collide — clamp positions inside the box;
 *   4. update — recover velocity from the position change, v = (x − x_prev)/dt, then apply drag.
 *
 * `stiffness` is exposed as an intuitive 0…1 knob and mapped to XPBD compliance α = inverse
 * stiffness (1 ⇒ rigid α=0; 0 ⇒ maximally compliant) — see `MAX_COMPLIANCE`.
 */
export const clothXpbdSchema = {
  cols: countParam({ label: 'Columns (X)', default: 18, min: 1, max: 48 }),
  rows: countParam({ label: 'Rows (Y)', default: 18, min: 1, max: 48 }),
  layers: countParam({ label: 'Layers (Z)', default: 1, min: 1, max: 12 }),
  spacing: sceneNumberParam({ label: 'Spacing', default: 0.7, min: 0.2, max: 3, step: 0.1 }),
  containerSize: containerParam({ label: 'Box Size', default: 26, min: 8, max: 60, step: 1 }),
  gravity: gravityParam({ default: 9, max: 30, step: 0.5 }),
  stiffness: { type: 'number', label: 'Stiffness', default: 0.85, min: 0, max: 1, step: 0.01 },
  iterations: { type: 'number', label: 'Solver Iterations', default: 8, min: 1, max: 24, step: 1 },
  damping: { type: 'number', label: 'Damping', default: 1, min: 0, max: 10, step: 0.5 },
  pinTop: { type: 'boolean', label: 'Pin Top Edge', default: true },
  shear: { type: 'boolean', label: 'Shear Constraints', default: true },
  bend: { type: 'boolean', label: 'Bend Constraints', default: true },
} as const

type Params = ParamValues<typeof clothXpbdSchema>

const PARTICLE_MASS = 1 // reduced units: unit mass per free node.

/**
 * XPBD is unconditionally stable, so the substep exists only to keep the *visual* motion and
 * the (predict-time) gravity integration smooth, not for stability. A modest fixed substep is
 * plenty; constraint stiffness comes from `iterations` + compliance, both timestep-independent.
 */
const XPBD_TIMESTEP = 1 / 120

/**
 * Compliance (inverse stiffness, α) at the softest end of the `stiffness` slider; `stiffness`
 * 0…1 maps linearly to compliance MAX_COMPLIANCE…0. Chosen so stiffness 0 visibly stretches the
 * cloth while stiffness 1 is effectively rigid. Compliance is timestep-independent by design.
 */
const MAX_COMPLIANCE = 0.005

/** Render radius as a fraction of node spacing — small enough that constraints read as structure. */
const RADIUS_PER_SPACING = 0.18

export function createClothXpbdMode(): SimMode<typeof clothXpbdSchema> {
  let count = 0
  let radius = 0
  let halfBound = 0
  let gravity = 0
  let compliance = 0
  let iterations = 1
  let damping = 0

  let positions = new Float64Array(0)
  let prevPositions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let invMass = new Float64Array(0)
  let lambdas = new Float64Array(0)
  let renderPositions = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  let network: SpringNetwork | null = null

  function init(ctx: SimContext<typeof clothXpbdSchema>): void {
    const p: Params = ctx.params
    gravity = p.gravity
    compliance = (1 - p.stiffness) * MAX_COMPLIANCE
    iterations = Math.max(1, Math.round(p.iterations))
    damping = p.damping
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

    positions = Float64Array.from(network.positions)
    prevPositions = Float64Array.from(network.positions)
    velocities = new Float64Array(count * 3)
    lambdas = new Float64Array(network.restLengths.length)
    renderPositions = new Float32Array(count * 3)
    renderVelocities = new Float32Array(count * 3)

    // Inverse mass: pinned nodes are immovable (w = 0); free nodes have unit mass (w = 1).
    invMass = new Float64Array(count)
    for (let i = 0; i < count; i++) invMass[i] = network.pinned[i] ? 0 : 1 / PARTICLE_MASS
  }

  function step(dt: number): void {
    if (!network || count === 0 || dt <= 0) return
    const { edges, restLengths } = network
    const subSteps = Math.max(1, Math.ceil(dt / XPBD_TIMESTEP))
    const subDt = dt / subSteps
    const dtSq = subDt * subDt
    const invSubDt = 1 / subDt
    const dragScale = Math.max(0, 1 - damping * subDt)

    for (let s = 0; s < subSteps; s++) {
      // 1. Predict: gravity into velocity, then advance positions (pinned nodes stay put).
      for (let i = 0; i < count; i++) {
        if (invMass[i] === 0) continue
        const o = i * 3
        prevPositions[o] = positions[o]
        prevPositions[o + 1] = positions[o + 1]
        prevPositions[o + 2] = positions[o + 2]
        velocities[o + 1] -= gravity * subDt
        positions[o] += velocities[o] * subDt
        positions[o + 1] += velocities[o + 1] * subDt
        positions[o + 2] += velocities[o + 2] * subDt
      }

      // 2. Project distance constraints; λ resets each substep, accumulates across iterations.
      lambdas.fill(0)
      for (let it = 0; it < iterations; it++) {
        solveDistanceConstraints(positions, invMass, edges, restLengths, lambdas, compliance, dtSq)
      }

      // 3. Collide with the box: clamp centres inside (a one-sided position constraint).
      for (let i = 0; i < count; i++) {
        if (invMass[i] === 0) continue
        const o = i * 3
        if (positions[o] > halfBound) positions[o] = halfBound
        else if (positions[o] < -halfBound) positions[o] = -halfBound
        if (positions[o + 1] > halfBound) positions[o + 1] = halfBound
        else if (positions[o + 1] < -halfBound) positions[o + 1] = -halfBound
        if (positions[o + 2] > halfBound) positions[o + 2] = halfBound
        else if (positions[o + 2] < -halfBound) positions[o + 2] = -halfBound
      }

      // 4. Update velocity from the actual position change, then apply velocity drag. Walls and
      // constraints therefore feed back into velocity automatically (no separate restitution).
      for (let i = 0; i < count; i++) {
        if (invMass[i] === 0) continue
        const o = i * 3
        velocities[o] = (positions[o] - prevPositions[o]) * invSubDt * dragScale
        velocities[o + 1] = (positions[o + 1] - prevPositions[o + 1]) * invSubDt * dragScale
        velocities[o + 2] = (positions[o + 2] - prevPositions[o + 2]) * invSubDt * dragScale
      }
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
      // XPBD projection is dissipative and gravity does work — total mechanical energy is not
      // conserved (flagged so conservation readouts are understood to drift).
      inelastic: gravity > 0 || damping > 0,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    prevPositions = new Float64Array(0)
    velocities = new Float64Array(0)
    invMass = new Float64Array(0)
    lambdas = new Float64Array(0)
    renderPositions = new Float32Array(0)
    renderVelocities = new Float32Array(0)
    network = null
    count = 0
  }

  return {
    id: 'xpbd-cloth',
    label: 'Cloth & Soft Body (XPBD)',
    backend: 'cpu',
    paramSchema: clothXpbdSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
