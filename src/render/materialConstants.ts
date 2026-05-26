/**
 * Shared PBR surface constants for the lit instanced bodies (particles and rigid bodies), so the
 * same surface reads identically under the scene's lighting everywhere. These are render-tuning
 * values, not design tokens (they aren't colors/spacing/type), so they live here rather than in
 * the token set — but, like tokens, they are defined once and reused, never re-typed per renderer.
 */
export const SURFACE_ROUGHNESS = 0.4
export const SURFACE_METALNESS = 0.1
