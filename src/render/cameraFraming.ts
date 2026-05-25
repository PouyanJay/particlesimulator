/**
 * Standardized "fit-to-box" camera framing.
 *
 * Every mode defines its own world scale through `containerSize` (the box ranges ~2.5 → 14
 * across modes because each is tuned in its own units), so a single hard-coded camera frames
 * them inconsistently. Instead we derive the camera distance from the active box so the
 * container fills the *same fraction* of the viewport in every mode: the framing rule is
 * standardized even though the absolute distance adapts. The render shell applies this on
 * initial load and re-applies it on every mode switch.
 */

/** Shared 3/4 viewing direction for every mode's default camera (normalised at use). */
const VIEW_DIR: readonly [number, number, number] = [1, 1, 1]

/**
 * Breathing room around the container's bounding sphere (1 = the sphere exactly fills the
 * vertical FOV; > 1 pulls back). Tuned so the box reads as framed with a little margin.
 */
const FRAMING_MARGIN = 1.3

/** Bounding-sphere radius of an origin-centred cube of side `containerSize`. */
function boundingRadius(containerSize: number): number {
  return (containerSize / 2) * Math.sqrt(3)
}

/**
 * Distance from the origin at which an origin-centred cube of side `containerSize` is
 * consistently framed for a perspective camera with vertical field of view `fovDeg`. Fits the
 * cube's bounding sphere to the vertical FOV (so nothing clips from any orbit angle) and adds
 * `FRAMING_MARGIN`. Linear in `containerSize`, which is what makes the framing identical
 * across modes regardless of their world size.
 */
export function cameraDistanceForContainer(containerSize: number, fovDeg: number): number {
  const halfFov = (fovDeg * Math.PI) / 180 / 2
  return (boundingRadius(containerSize) / Math.sin(halfFov)) * FRAMING_MARGIN
}

/** The default camera position: the framing distance along the shared `VIEW_DIR`. */
export function defaultCameraPosition(containerSize: number, fovDeg: number): [number, number, number] {
  const distance = cameraDistanceForContainer(containerSize, fovDeg)
  const length = Math.hypot(VIEW_DIR[0], VIEW_DIR[1], VIEW_DIR[2])
  const scale = distance / length
  return [VIEW_DIR[0] * scale, VIEW_DIR[1] * scale, VIEW_DIR[2] * scale]
}

/**
 * Orbit zoom limits scaled to the box, so "how close / how far you can zoom" feels the same in
 * every mode: in to roughly the box surface, out to a few times the framing distance.
 */
export function zoomLimitsForContainer(containerSize: number, fovDeg: number): { min: number; max: number } {
  return {
    min: boundingRadius(containerSize) * 0.4,
    max: cameraDistanceForContainer(containerSize, fovDeg) * 3,
  }
}
