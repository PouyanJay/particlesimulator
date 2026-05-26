import { poly6, spikyGradientCoefficient, viscosityLaplacian } from './sphKernels'
import { createSpatialGrid, type SpatialGrid } from './spatialGrid'

/**
 * Grid-accelerated SPH field: per-particle density, then the internal pressure and viscosity
 * accelerations — the kernel that defines the fluid mode (the CPU reference for a later GPU port,
 * per the GPU-testing strategy in CLAUDE.md). Mirrors `lennardJonesField`'s scratch discipline so
 * the hot loop allocates nothing.
 *
 * Two passes, because a particle's pressure force depends on *all* densities:
 *   1. `computeDensities` — ρᵢ = m·Σⱼ W_poly6(rᵢⱼ) including the self term m·W(0), so an isolated
 *      particle still has a finite density. Built from the uniform grid (cell size = h); the result
 *      equals the brute-force O(N²) sum (verified in tests).
 *   2. `computeAccelerations` — using those densities, the **symmetric** pressure and viscosity
 *      accelerations, evaluated once per pair and applied equal-and-opposite so total momentum is
 *      conserved (also verified):
 *        pressure:  aᵢ += −m·(Pᵢ/ρᵢ² + Pⱼ/ρⱼ²)·∇W_spiky(rᵢⱼ),  P = max(0, k·(ρ − ρ₀))   (Tait-linear EOS)
 *        viscosity: aᵢ += μ·m·(vⱼ − vᵢ)/(ρᵢ·ρⱼ)·∇²W_visc(rᵢⱼ)
 *
 * `computeAccelerations` reuses the grid built by `computeDensities`, so it must be called after it
 * with the same positions (the mode does this each substep). Gravity is *not* applied here — the
 * field's forces are purely internal (hence momentum-conserving and testable); the mode adds gravity.
 *
 * Numerical stability: weakly-compressible SPH needs dissipation or pressure oscillations
 * self-amplify (it "boils") regardless of the physical viscosity. An always-on **Monaghan
 * artificial viscosity** provides it — it acts only on *approaching* pairs (so it never adds
 * spurious attraction), is symmetric (momentum-conserving), and decouples stability from the
 * user's physical-viscosity setting (which can validly be zero).
 */
export interface SphFieldParams {
  /** Per-particle mass (equal for all particles). */
  mass: number
  /** Rest density ρ₀ — pressure is zero at this density. */
  restDensity: number
  /** Pressure stiffness k in the linear equation of state P = max(0, k·(ρ − ρ₀)). */
  stiffness: number
  /** Dynamic viscosity coefficient μ. */
  viscosity: number
  /** Smoothing radius h (kernel support; also the grid cell size). */
  smoothingRadius: number
}

export interface SphField {
  /** Write per-particle density (incl. self) into `outDensity` (length count); rebuilds the grid. */
  computeDensities(positions: Readonly<Float64Array>, count: number, outDensity: Float64Array): void
  /**
   * Write per-particle pressure + viscosity accelerations into `outAccel` (xyz, length 3·count).
   * Reuses the grid from the preceding `computeDensities` call on the same positions.
   */
  computeAccelerations(
    positions: Readonly<Float64Array>,
    velocities: Readonly<Float64Array>,
    densities: Readonly<Float64Array>,
    count: number,
    outAccel: Float64Array,
  ): void
}

export function createSphField(
  params: SphFieldParams,
  grid: SpatialGrid = createSpatialGrid(params.smoothingRadius),
): SphField {
  const { mass, restDensity, stiffness, viscosity, smoothingRadius: h } = params
  const selfDensity = mass * poly6(0, h)
  // Artificial-viscosity strength and the numerical sound speed it scales with. For the linear
  // EOS P = k·(ρ − ρ₀), the sound speed is c = √(k/ρ₀); α ≈ 0.5 is the usual stabilising value.
  const AV_ALPHA = 0.5
  const soundSpeed = Math.sqrt(stiffness / restDensity)

  // Scratch shared with the neighbour callbacks so they allocate nothing per call.
  let pos: Readonly<Float64Array> = new Float64Array(0)
  let vel: Readonly<Float64Array> = new Float64Array(0)
  let dens: Readonly<Float64Array> = new Float64Array(0)
  let acc: Float64Array = new Float64Array(0)
  let probe = 0
  let xi = 0
  let yi = 0
  let zi = 0
  let densitySum = 0

  function onDensityNeighbor(other: number): void {
    const oj = other * 3
    const dx = pos[oj] - xi
    const dy = pos[oj + 1] - yi
    const dz = pos[oj + 2] - zi
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (r < h) densitySum += poly6(r, h)
  }

  /** Pressure from density via the clamped linear EOS (no tensile/negative pressure). */
  function pressureOf(density: number): number {
    const p = stiffness * (density - restDensity)
    return p > 0 ? p : 0
  }

  function onForceNeighbor(other: number): void {
    if (other <= probe) return // each unordered pair once
    const oj = other * 3
    const dx = xi - pos[oj] // separation i ← j (points from j toward i)
    const dy = yi - pos[oj + 1]
    const dz = zi - pos[oj + 2]
    const distSq = dx * dx + dy * dy + dz * dz
    if (distSq >= h * h || distSq === 0) return
    const r = Math.sqrt(distSq)
    const inv = 1 / r

    const rhoI = dens[probe]
    const rhoJ = dens[other]
    const pI = pressureOf(rhoI)
    const pJ = pressureOf(rhoJ)
    const oi3 = probe * 3

    // Monaghan artificial-viscosity pressure Πᵢⱼ — non-zero only when the pair is approaching
    // (relative velocity along the separation is negative), so it damps compression shocks
    // without adding cohesion. Symmetric in i,j ⇒ momentum-conserving.
    const vDotR = (vel[oi3] - vel[oj]) * dx + (vel[oi3 + 1] - vel[oj + 1]) * dy + (vel[oi3 + 2] - vel[oj + 2]) * dz
    let avPressure = 0
    if (vDotR < 0) {
      const muIj = (h * vDotR) / (distSq + 0.01 * h * h)
      avPressure = (-AV_ALPHA * soundSpeed * muIj) / (0.5 * (rhoI + rhoJ)) // > 0 (muIj < 0)
    }

    // Symmetric pressure + artificial-viscosity acceleration along the separation. spiky
    // coefficient is negative; with the pressure-like term ≥ 0 the result points along r̂
    // (from j to i), i.e. it pushes the two particles apart / damps their approach.
    const pressureScale =
      -mass * (pI / (rhoI * rhoI) + pJ / (rhoJ * rhoJ) + avPressure) * spikyGradientCoefficient(r, h)
    const pfx = pressureScale * dx * inv
    const pfy = pressureScale * dy * inv
    const pfz = pressureScale * dz * inv

    // Symmetric (physical) viscosity acceleration: damps the relative velocity along the kernel.
    const viscScale = (viscosity * mass * viscosityLaplacian(r, h)) / (rhoI * rhoJ)
    const vfx = viscScale * (vel[oj] - vel[oi3])
    const vfy = viscScale * (vel[oj + 1] - vel[oi3 + 1])
    const vfz = viscScale * (vel[oj + 2] - vel[oi3 + 2])

    acc[oi3] += pfx + vfx
    acc[oi3 + 1] += pfy + vfy
    acc[oi3 + 2] += pfz + vfz
    acc[oj] -= pfx + vfx // equal and opposite (momentum-conserving)
    acc[oj + 1] -= pfy + vfy
    acc[oj + 2] -= pfz + vfz
  }

  function rebuildGrid(positions: Readonly<Float64Array>, count: number): void {
    grid.clear()
    for (let i = 0; i < count; i++) grid.insert(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
  }

  return {
    computeDensities(positions, count, outDensity) {
      pos = positions
      rebuildGrid(positions, count)
      for (let i = 0; i < count; i++) {
        xi = positions[i * 3]
        yi = positions[i * 3 + 1]
        zi = positions[i * 3 + 2]
        densitySum = 0
        grid.forEachNeighbor(i, xi, yi, zi, onDensityNeighbor)
        outDensity[i] = selfDensity + mass * densitySum // self term + neighbour contributions
      }
    },

    computeAccelerations(positions, velocities, densities, count, outAccel) {
      pos = positions
      vel = velocities
      dens = densities
      acc = outAccel
      outAccel.fill(0)
      for (let i = 0; i < count; i++) {
        probe = i
        xi = positions[i * 3]
        yi = positions[i * 3 + 1]
        zi = positions[i * 3 + 2]
        grid.forEachNeighbor(i, xi, yi, zi, onForceNeighbor)
      }
    },
  }
}
