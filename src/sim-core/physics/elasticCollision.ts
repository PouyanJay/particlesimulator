import { add, sub, dot, length, scale, type Vec3 } from '../math/vec3'

/**
 * Resolve a binary collision by applying an equal-and-opposite normal impulse.
 *
 * Conserves total momentum for any restitution `e`; conserves kinetic energy when
 * `e == 1` (perfectly elastic). Particles that are already separating along the
 * contact normal are returned unchanged so no spurious energy is injected.
 *
 * @returns the post-collision velocities `[v1', v2']`.
 */
export function resolveElasticCollision(
  p1: Vec3,
  v1: Vec3,
  m1: number,
  p2: Vec3,
  v2: Vec3,
  m2: number,
  restitution: number,
): [Vec3, Vec3] {
  // Contact normal pointing from particle 1 to particle 2.
  const delta = sub(p2, p1)
  const dist = length(delta)
  if (dist === 0) return [v1, v2] // coincident centers: no well-defined normal.
  const n: Vec3 = [delta[0] / dist, delta[1] / dist, delta[2] / dist]

  // Closing speed along the normal (positive ⇒ approaching).
  const relativeNormalSpeed = dot(sub(v1, v2), n)
  if (relativeNormalSpeed <= 0) return [v1, v2] // separating or grazing.

  // Impulse magnitude. j = (1 + e) * v_rel / (1/m1 + 1/m2).
  const j = ((1 + restitution) * relativeNormalSpeed) / (1 / m1 + 1 / m2)
  const v1Next = sub(v1, scale(n, j / m1))
  const v2Next = add(v2, scale(n, j / m2))
  return [v1Next, v2Next]
}
