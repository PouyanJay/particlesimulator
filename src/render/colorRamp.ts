/**
 * Maps a particle speed to an sRGB color along a direct blue→red blend: the slowest
 * particles are blue, the fastest are red, with a smooth two-stop interpolation in
 * between (no hue sweep through green/yellow). Pure and framework-free so it's
 * unit-testable; the render layer feeds the result into a THREE.Color via `setRGB`
 * (with the sRGB color space) and `setColorAt`.
 *
 * Writes into the optional `out` array (reused by the render hot loop to avoid
 * per-particle allocation) and returns it.
 *
 * @returns sRGB `[r, g, b]`, each in [0, 1].
 */

/** Slow-end color (min speed): blue (#3b82f6). */
export const SLOW_COLOR: readonly [number, number, number] = [0.231, 0.51, 0.965]
/** Fast-end color (max speed): red (#ef4444). */
export const FAST_COLOR: readonly [number, number, number] = [0.937, 0.267, 0.267]

/**
 * Categorical palette for color-by-type modes (e.g. Particle Life). The Okabe–Ito set
 * is color-blind-safe; indexed by particle type (wraps if there are more types).
 */
export const TYPE_PALETTE: readonly string[] = [
  '#56b4e9', // sky blue
  '#e69f00', // orange
  '#009e73', // green
  '#f0e442', // yellow
  '#cc79a7', // pink
  '#0072b2', // blue
]

export function speedToRgb(
  speed: number,
  vMax: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const t = vMax > 0 ? Math.min(1, Math.max(0, speed / vMax)) : 0
  // Exact endpoints (avoids float drift at t = 0 / 1).
  if (t <= 0) {
    out[0] = SLOW_COLOR[0]
    out[1] = SLOW_COLOR[1]
    out[2] = SLOW_COLOR[2]
  } else if (t >= 1) {
    out[0] = FAST_COLOR[0]
    out[1] = FAST_COLOR[1]
    out[2] = FAST_COLOR[2]
  } else {
    out[0] = SLOW_COLOR[0] + (FAST_COLOR[0] - SLOW_COLOR[0]) * t
    out[1] = SLOW_COLOR[1] + (FAST_COLOR[1] - SLOW_COLOR[1]) * t
    out[2] = SLOW_COLOR[2] + (FAST_COLOR[2] - SLOW_COLOR[2]) * t
  }
  return out
}
