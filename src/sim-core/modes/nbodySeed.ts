import { createRng, randomInRange } from '../rng'

/**
 * Seed a flattened, spinning disk of bodies into the provided position/velocity arrays
 * (xyz-interleaved, length 3·count). Shared by the CPU N-body mode (Float64) and the GPU
 * N-body mode (Float32) so both start from the identical, seed-reproducible state.
 *
 * Positions: x,z in [-r, r], y compressed to [-0.3r, 0.3r] (a disk), r = containerSize/4.
 * Velocities: rigid rotation about Y, v = (rotation·z, 0, -rotation·x).
 */
export function seedNbodyDisk(
  seed: number,
  count: number,
  containerSize: number,
  rotation: number,
  outPositions: Float32Array | Float64Array,
  outVelocities: Float32Array | Float64Array,
): void {
  const rng = createRng(seed)
  const r = containerSize * 0.25
  for (let i = 0; i < count; i++) {
    const o = i * 3
    const x = randomInRange(rng, -r, r)
    const y = randomInRange(rng, -r * 0.3, r * 0.3)
    const z = randomInRange(rng, -r, r)
    outPositions[o] = x
    outPositions[o + 1] = y
    outPositions[o + 2] = z
    outVelocities[o] = rotation * z
    outVelocities[o + 1] = 0
    outVelocities[o + 2] = -rotation * x
  }
}
