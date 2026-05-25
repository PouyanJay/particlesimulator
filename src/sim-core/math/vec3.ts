/**
 * Minimal immutable 3-vector helpers used by the collision kernel and telemetry.
 *
 * Represented as a readonly tuple so values are cheap to construct and safe to share.
 * Hot per-particle integration works directly on flat Float32Arrays elsewhere; these
 * helpers favour clarity for the lower-frequency, scalar-level math.
 */
export type Vec3 = readonly [number, number, number]

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function lengthSq(a: Vec3): number {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]
}

export function length(a: Vec3): number {
  return Math.sqrt(lengthSq(a))
}
