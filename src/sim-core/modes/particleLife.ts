import { createRng, randomInRange } from '../rng'
import { particleLifeForce } from '../physics/particleLifeForce'
import { createSpatialGrid, type SpatialGrid } from '../physics/spatialGrid'
import type { ParamValues, ParticleBuffers, SimContext, SimMode } from '../types'

/**
 * Particle-Life — an emergent-behavior mode. Each particle has a color *type*; an
 * asymmetric type×type matrix sets whether a pair attracts or repels at mid range,
 * while a universal short-range repulsion stops collapse. Simple local rules produce
 * lifelike clusters, chasers, and membranes (Ventrella "Clusters" / lisyarus).
 *
 * CPU reference using the shared spatial grid (cell size = interaction radius) so the
 * neighbour sum is ~O(N). The matrix and initial state derive from the seed, so a run
 * is fully reproducible; "reset" (a new seed) draws a fresh matrix and layout.
 */
export const particleLifeSchema = {
  particleCount: { type: 'number', label: 'Particle Count', default: 800, min: 50, max: 20000, step: 10 },
  numTypes: { type: 'number', label: 'Types', default: 4, min: 2, max: 6, step: 1 },
  forceRadius: { type: 'number', label: 'Force Radius', default: 0.5, min: 0.1, max: 1.5, step: 0.05 },
  repulsion: { type: 'number', label: 'Repulsion Zone', default: 0.3, min: 0.1, max: 0.6, step: 0.05 },
  forceStrength: { type: 'number', label: 'Force Strength', default: 1.0, min: 0.1, max: 5, step: 0.1 },
  damping: { type: 'number', label: 'Damping', default: 1.5, min: 0.1, max: 5, step: 0.1 },
  containerSize: { type: 'number', label: 'Container Size', default: 4, min: 2, max: 10, step: 0.5 },
  particleRadius: { type: 'number', label: 'Particle Size', default: 0.05, min: 0.02, max: 0.15, step: 0.01 },
} as const

type Params = ParamValues<typeof particleLifeSchema>

export function createParticleLifeMode(): SimMode<typeof particleLifeSchema> {
  let count = 0
  let radius = 0
  let numTypes = 0
  let forceRadius = 0.5
  let beta = 0.3
  let forceStrength = 1
  let damping = 1.5
  let halfBound = 0
  let positions = new Float64Array(0)
  let velocities = new Float64Array(0)
  let types = new Uint8Array(0)
  // Flattened numTypes×numTypes attraction matrix: matrix[a * numTypes + b].
  let matrix = new Float64Array(0)
  let renderPositions = new Float32Array(0)

  let grid: SpatialGrid | null = null

  // Scratch shared with the grid neighbour callback (no per-frame closure allocation).
  let probe = 0
  let probeType = 0
  let accX = 0
  let accY = 0
  let accZ = 0

  function init(ctx: SimContext<typeof particleLifeSchema>): void {
    const p: Params = ctx.params
    count = p.particleCount
    radius = p.particleRadius
    numTypes = p.numTypes
    forceRadius = p.forceRadius
    beta = p.repulsion
    forceStrength = p.forceStrength
    damping = p.damping
    halfBound = p.containerSize / 2 - radius

    positions = new Float64Array(count * 3)
    velocities = new Float64Array(count * 3) // start at rest; forces drive motion
    types = new Uint8Array(count)
    renderPositions = new Float32Array(count * 3)
    grid = createSpatialGrid(forceRadius)

    const rng = createRng(ctx.seed)
    // Draw the asymmetric interaction matrix first, then the layout — all from one stream.
    matrix = new Float64Array(numTypes * numTypes)
    for (let i = 0; i < matrix.length; i++) matrix[i] = rng() * 2 - 1 // [-1, 1]

    for (let i = 0; i < count; i++) {
      const o = i * 3
      positions[o] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 1] = randomInRange(rng, -halfBound, halfBound)
      positions[o + 2] = randomInRange(rng, -halfBound, halfBound)
      types[i] = Math.min(numTypes - 1, Math.floor(rng() * numTypes))
    }
  }

  /** Accumulate the force on `probe` from one neighbour candidate. */
  function onNeighbor(other: number): void {
    const op = probe * 3
    const oo = other * 3
    const dx = positions[oo] - positions[op]
    const dy = positions[oo + 1] - positions[op + 1]
    const dz = positions[oo + 2] - positions[op + 2]
    const distSq = dx * dx + dy * dy + dz * dz
    if (distSq === 0 || distSq >= forceRadius * forceRadius) return
    const dist = Math.sqrt(distSq)
    const a = matrix[probeType * numTypes + types[other]]
    const f = particleLifeForce(dist / forceRadius, a, beta)
    const inv = f / dist // f * (unit direction probe→other)
    accX += dx * inv
    accY += dy * inv
    accZ += dz * inv
  }

  function step(dt: number): void {
    if (!grid) return
    // Rebuild the neighbour grid from current positions.
    grid.clear()
    for (let i = 0; i < count; i++) grid.insert(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])

    const dampFactor = Math.exp(-damping * dt)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      probe = i
      probeType = types[i]
      accX = 0
      accY = 0
      accZ = 0
      grid.forEachNeighbor(i, positions[o], positions[o + 1], positions[o + 2], onNeighbor)

      // Semi-implicit Euler with velocity damping.
      let vx = (velocities[o] + accX * forceStrength * dt) * dampFactor
      let vy = (velocities[o + 1] + accY * forceStrength * dt) * dampFactor
      let vz = (velocities[o + 2] + accZ * forceStrength * dt) * dampFactor

      let px = positions[o] + vx * dt
      let py = positions[o + 1] + vy * dt
      let pz = positions[o + 2] + vz * dt

      // Reflect off the container walls (keeps clusters contained).
      if (px > halfBound) { px = halfBound; vx = -Math.abs(vx) } else if (px < -halfBound) { px = -halfBound; vx = Math.abs(vx) }
      if (py > halfBound) { py = halfBound; vy = -Math.abs(vy) } else if (py < -halfBound) { py = -halfBound; vy = Math.abs(vy) }
      if (pz > halfBound) { pz = halfBound; vz = -Math.abs(vz) } else if (pz < -halfBound) { pz = -halfBound; vz = Math.abs(vz) }

      velocities[o] = vx
      velocities[o + 1] = vy
      velocities[o + 2] = vz
      positions[o] = px
      positions[o + 1] = py
      positions[o + 2] = pz
    }
  }

  function getBuffers(): ParticleBuffers {
    for (let i = 0; i < renderPositions.length; i++) renderPositions[i] = positions[i]
    return { count, positions: renderPositions, types, radius }
  }

  function getTelemetry() {
    let speedSum = 0
    for (let i = 0; i < count; i++) {
      const o = i * 3
      speedSum += Math.sqrt(velocities[o] ** 2 + velocities[o + 1] ** 2 + velocities[o + 2] ** 2)
    }
    return {
      particleCount: count,
      averageSpeed: count > 0 ? speedSum / count : 0,
      kineticEnergy: 0,
    }
  }

  function dispose(): void {
    positions = new Float64Array(0)
    velocities = new Float64Array(0)
    types = new Uint8Array(0)
    matrix = new Float64Array(0)
    renderPositions = new Float32Array(0)
    grid = null
    count = 0
  }

  return {
    id: 'particle-life',
    label: 'Particle Life',
    backend: 'cpu',
    paramSchema: particleLifeSchema,
    init,
    step,
    getTelemetry,
    getBuffers,
    dispose,
  }
}
