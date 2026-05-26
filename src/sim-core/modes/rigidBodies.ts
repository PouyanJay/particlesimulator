import type RapierNamespace from '@dimforge/rapier3d-compat'
import { getRapier } from '../physics/rapierEngine'
import { createRng } from '../rng'
import { countParam, containerParam, gravityParam, sceneNumberParam } from '../params/common'
import { ShapeType, type ParamValues, type ParticleBuffers, type SimContext, type SimMode, type Telemetry } from '../types'

type RigidBody = InstanceType<typeof RapierNamespace.RigidBody>
type World = InstanceType<typeof RapierNamespace.World>

/**
 * Rigid-body sandbox — the one mode backed by **Rapier** (a CPU constraint solver) rather than a
 * custom force/projection kernel, because correct contact resolution, friction, restitution and
 * stacking is exactly what Rapier is best-in-class at, and the body counts here stay modest (the
 * hybrid-backend decision in the plan). A mix of seeded boxes and spheres is dropped into a walled
 * box and left to fall, collide and stack under gravity.
 *
 * It is a normal `SimMode` (backend `'rapier'`), so the app shell and driver treat it like any
 * other: the render layer dispatches on the backend to a renderer that draws *oriented, varied*
 * shapes (boxes/spheres) from the buffers' `orientations` / `shapeTypes` / `halfExtents` — the
 * first non-particle render representation. Rapier's WASM is async, so the render layer awaits
 * `ensureRapierReady()` before loading; `init` then pulls the ready namespace via `getRapier()`.
 */
export const rigidBodiesSchema = {
  bodyCount: countParam({ label: 'Body Count', default: 80, min: 1, max: 400 }),
  containerSize: containerParam({ label: 'Box Size', default: 16, min: 6, max: 40, step: 1 }),
  bodySize: sceneNumberParam({ label: 'Body Size', default: 1, min: 0.3, max: 3, step: 0.1 }),
  gravity: gravityParam({ default: 9.81, max: 30, step: 0.5 }),
  restitution: { type: 'number', label: 'Restitution', default: 0.4, min: 0, max: 1, step: 0.05 },
  friction: { type: 'number', label: 'Friction', default: 0.6, min: 0, max: 2, step: 0.05 },
  boxFraction: { type: 'number', label: 'Box Fraction', default: 0.5, min: 0, max: 1, step: 0.05 },
  sizeVariation: { type: 'number', label: 'Size Variation', default: 0.4, min: 0, max: 1, step: 0.05 },
} as const

type Params = ParamValues<typeof rigidBodiesSchema>

/** Half-thickness of the static floor/wall slabs. */
const WALL_THICKNESS = 0.5

export function createRigidBodiesMode(): SimMode<typeof rigidBodiesSchema> {
  let world: World | null = null
  let bodies: RigidBody[] = []
  let count = 0
  let radius = 0

  let shapeTypes = new Uint8Array(0)
  let halfExtents = new Float32Array(0)
  let renderPositions = new Float32Array(0)
  let renderOrientations = new Float32Array(0)
  let renderVelocities = new Float32Array(0)

  function init(ctx: SimContext<typeof rigidBodiesSchema>): void {
    const RAPIER = getRapier()
    const p: Params = ctx.params
    count = p.bodyCount
    radius = p.bodySize / 2
    const half = p.containerSize / 2

    world = new RAPIER.World({ x: 0, y: -p.gravity, z: 0 })

    // Static container: floor + four walls (open top so the scene is visible). Inner faces sit at
    // ±half / floor top at −half, matching the rendered wireframe box.
    const t = WALL_THICKNESS
    const addStatic = (hx: number, hy: number, hz: number, x: number, y: number, z: number): void => {
      world!.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRestitution(p.restitution).setFriction(p.friction),
      )
    }
    addStatic(half, t, half, 0, -half - t, 0) // floor
    addStatic(t, half, half, half + t, 0, 0) // +x wall
    addStatic(t, half, half, -half - t, 0, 0) // −x wall
    addStatic(half, half, t, 0, 0, half + t) // +z wall
    addStatic(half, half, t, 0, 0, -half - t) // −z wall
    addStatic(half, t, half, 0, half + t, 0) // ceiling (collision-only; the box renders open-topped)

    const rng = createRng(ctx.seed)
    const maxHalf = radius * (1 + p.sizeVariation) // largest possible body half-size after variation
    const diameter = 2 * maxHalf
    // A spawn gap strictly larger than zero guarantees no two bodies start interpenetrating —
    // Rapier resolves initial overlap with huge separating impulses that would launch bodies out
    // of the box. The grid cell is therefore never smaller than a body diameter plus this gap.
    const gap = Math.max(0.1, 0.15 * diameter)
    const cell = diameter + gap

    // Grid kept strictly inside the closed box. We place at most as many bodies as fit without
    // overlap; with the ceiling above, whatever is placed stays contained for any parameters.
    const innerXZ = Math.max(0, half - maxHalf - 0.05) // body-centre bound that keeps faces inside
    const topY = half - maxHalf - 0.05
    const botY = -half + maxHalf + 0.05
    const perRow = Math.max(1, Math.floor((2 * innerXZ) / cell) + 1)
    const layers = Math.max(1, Math.floor(Math.max(0, topY - botY) / cell) + 1)
    count = Math.min(count, perRow * perRow * layers) // clamp to what the box can hold without overlap

    const originXZ = ((perRow - 1) * cell) / 2
    const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

    bodies = []
    shapeTypes = new Uint8Array(count)
    halfExtents = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const col = i % perRow
      const row = Math.floor(i / perRow) % perRow
      const layer = Math.floor(i / (perRow * perRow))

      const isBox = rng() < p.boxFraction
      shapeTypes[i] = isBox ? ShapeType.Box : ShapeType.Sphere
      // Per-axis size variation (boxes become slightly non-cubic; spheres use a single radius).
      const vary = (): number => radius * (1 + (rng() * 2 - 1) * p.sizeVariation)
      const hx = vary()
      const hy = isBox ? vary() : hx
      const hz = isBox ? vary() : hx
      const o3 = i * 3
      halfExtents[o3] = hx
      halfExtents[o3 + 1] = hy
      halfExtents[o3 + 2] = hz

      // Jitter is bounded to a fraction of the gap so it can never close it (no overlap).
      const j = (): number => (rng() - 0.5) * gap * 0.4
      const px = clamp(col * cell - originXZ + j(), -innerXZ, innerXZ)
      const pz = clamp(row * cell - originXZ + j(), -innerXZ, innerXZ)
      // Fill from the top down, so bodies start high and fall into the empty space below.
      const py = clamp(topY - layer * cell + j(), botY, topY)

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(px, py, pz))
      const collider = isBox ? RAPIER.ColliderDesc.cuboid(hx, hy, hz) : RAPIER.ColliderDesc.ball(hx)
      world.createCollider(collider.setRestitution(p.restitution).setFriction(p.friction), body)
      bodies.push(body)
    }

    renderPositions = new Float32Array(count * 3)
    renderOrientations = new Float32Array(count * 4)
    renderVelocities = new Float32Array(count * 3)
  }

  function step(dt: number): void {
    if (!world || dt <= 0) return
    world.timestep = dt // honour the driver's fixed timestep
    world.step()
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < count; i++) {
      const body = bodies[i]
      const t = body.translation()
      const r = body.rotation()
      const v = body.linvel()
      const o3 = i * 3
      const o4 = i * 4
      renderPositions[o3] = t.x
      renderPositions[o3 + 1] = t.y
      renderPositions[o3 + 2] = t.z
      renderOrientations[o4] = r.x
      renderOrientations[o4 + 1] = r.y
      renderOrientations[o4 + 2] = r.z
      renderOrientations[o4 + 3] = r.w
      renderVelocities[o3] = v.x
      renderVelocities[o3 + 1] = v.y
      renderVelocities[o3 + 2] = v.z
    }
    return {
      count,
      positions: renderPositions,
      velocities: renderVelocities,
      orientations: renderOrientations,
      shapeTypes,
      halfExtents,
      radius,
    }
  }

  function getTelemetry(): Telemetry {
    let speedSum = 0
    let massSpeedSq = 0 // Σ m·v² (translational); halved below for KE
    for (let i = 0; i < count; i++) {
      const body = bodies[i]
      const v = body.linvel()
      const speedSq = v.x * v.x + v.y * v.y + v.z * v.z
      speedSum += Math.sqrt(speedSq)
      massSpeedSq += body.mass() * speedSq
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      // Translational kinetic energy ½·Σ m·v². Rotational energy (½·ω·I·ω) is omitted — it's a
      // minority of the total for tumbling bodies and needs the inertia tensor in the body frame.
      kineticEnergy: 0.5 * massSpeedSq,
      // Gravity does work and contacts (restitution < 1 and friction) dissipate, so total
      // mechanical energy is never conserved here — the conservation readouts are expected to drift.
      inelastic: true,
    }
  }

  function dispose(): void {
    world?.free()
    world = null
    bodies = []
    count = 0
    shapeTypes = new Uint8Array(0)
    halfExtents = new Float32Array(0)
    renderPositions = new Float32Array(0)
    renderOrientations = new Float32Array(0)
    renderVelocities = new Float32Array(0)
  }

  return {
    id: 'rigid-bodies',
    label: 'Rigid-Body Sandbox',
    backend: 'rapier',
    paramSchema: rigidBodiesSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
