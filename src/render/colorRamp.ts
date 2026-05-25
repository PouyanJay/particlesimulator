/**
 * Maps a particle speed to an sRGB color along a direct blue→red blend: the slowest
 * particles are blue, the fastest are red, with a smooth two-stop interpolation in
 * between (no hue sweep through green/yellow). Pure and framework-free so it's
 * unit-testable; the render layer feeds the result into a THREE.Color via `setRGB`
 * (with the sRGB color space) and `setColorAt`.
 *
 * @returns sRGB `[r, g, b]`, each in [0, 1].
 */

/** Slow-end color (min speed): blue (#3b82f6). */
export const SLOW_COLOR: readonly [number, number, number] = [0.231, 0.51, 0.965]
/** Fast-end color (max speed): red (#ef4444). */
export const FAST_COLOR: readonly [number, number, number] = [0.937, 0.267, 0.267]

export function speedToRgb(speed: number, vMax: number): [number, number, number] {
  const t = vMax > 0 ? Math.min(1, Math.max(0, speed / vMax)) : 0
  // Exact endpoints (avoids float drift at t = 0 / 1).
  if (t <= 0) return [SLOW_COLOR[0], SLOW_COLOR[1], SLOW_COLOR[2]]
  if (t >= 1) return [FAST_COLOR[0], FAST_COLOR[1], FAST_COLOR[2]]
  return [
    SLOW_COLOR[0] + (FAST_COLOR[0] - SLOW_COLOR[0]) * t,
    SLOW_COLOR[1] + (FAST_COLOR[1] - SLOW_COLOR[1]) * t,
    SLOW_COLOR[2] + (FAST_COLOR[2] - SLOW_COLOR[2]) * t,
  ]
}
