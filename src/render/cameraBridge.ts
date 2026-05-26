import type { CameraPose } from '../sim-core/scenario'

/**
 * A tiny bridge between the UI/state layers (which save, share, and load scenarios) and the
 * live three.js camera (which lives inside the R3F canvas). It lets the UI read the current
 * viewpoint and request a viewpoint without the state layer importing the render layer or
 * prop-drilling refs through the tree. The canvas registers its camera once; everyone else
 * calls these free functions.
 */
export interface CameraApi {
  /** Current camera framing (position + orbit target), in world units. */
  getPose(): CameraPose
  /** Move the camera (and orbit target) to the given framing. */
  setPose(pose: CameraPose): void
}

let api: CameraApi | null = null
// A pose requested before the camera exists (e.g. a scenario loaded from a URL at startup),
// held until the camera rig mounts and consumes it.
let pending: CameraPose | null = null

/** Called by the canvas to (un)register the live camera. Pass null on unmount. */
export function registerCamera(next: CameraApi | null): void {
  api = next
}

/** Read the current viewpoint, or null if the canvas isn't mounted yet. */
export function captureCameraPose(): CameraPose | null {
  return api ? api.getPose() : null
}

/**
 * Apply a viewpoint now if the camera exists; otherwise queue it for the rig to apply on
 * mount. Used when restoring a shared/preset scenario for the already-active mode.
 */
export function applyCameraPose(pose: CameraPose): void {
  if (api) api.setPose(pose)
  else pending = pose
}

/**
 * Queue a viewpoint for the camera rig to apply on its next sync (used when the scenario
 * also changes the mode/view, so the queued pose overrides the mode's default framing).
 */
export function queueCameraPose(pose: CameraPose): void {
  pending = pose
}

/** Take the pending pose (if any), clearing it. Called by the rig when it (re)frames. */
export function consumePendingCameraPose(): CameraPose | null {
  const pose = pending
  pending = null
  return pose
}
