/**
 * Maps a particle speed to an HSL color along a cool→warm ramp: slow particles are blue,
 * fast particles are red. Pure and framework-free so it's unit-testable; the render layer
 * feeds the result into a THREE.Color via `setColorAt`.
 *
 * @returns `[hue, saturation, lightness]`, each in [0, 1].
 */
export function speedToHsl(speed: number, vMax: number): [number, number, number] {
  const t = vMax > 0 ? Math.min(1, Math.max(0, speed / vMax)) : 0
  const BLUE_HUE = 0.66 // hue at the slow end; ramps down to 0 (red) as t → 1
  return [(1 - t) * BLUE_HUE, 0.85, 0.55]
}
