/**
 * Shared PBR surface constants for the lit instanced bodies (particles and rigid bodies), so the
 * same surface reads identically under the scene's lighting everywhere. These are render-tuning
 * values, not design tokens (they aren't colors/spacing/type), so they live here rather than in
 * the token set — but, like tokens, they are defined once and reused, never re-typed per renderer.
 */
export const SURFACE_ROUGHNESS = 0.35
export const SURFACE_METALNESS = 0.2

/**
 * How strongly PBR surfaces pick up the image-based-lighting environment.
 *
 * IMPORTANT (TSL node-material gotcha): when the environment comes from `scene.environment`
 * (our case — no per-material `envMap` is assigned), three's node materials scale the IBL by
 * `scene.environmentIntensity`, NOT by each material's `envMapIntensity`
 * (see three/src/nodes/accessors/MaterialProperties.js: `material.envMap ? material.envMapIntensity
 * : scene.environmentIntensity`). So this single value is applied to `scene.environmentIntensity`
 * in SceneEnvironment and governs the IBL strength for every lit body uniformly.
 *
 * Kept low and deliberate: enough to give the surfaces a soft ambient fill and a faint reflective
 * sheen — the "refined dark technical instrument" look — without turning them into chrome or
 * lifting their baseline luminance into the bloom threshold (PostFx).
 */
export const ENV_MAP_INTENSITY = 0.55

/**
 * Per-instance shadow casting is expensive: each caster re-renders the shadow map, so casting
 * thousands of instanced spheres tanks fps. We therefore gate `castShadow` on the active mode's
 * body count — only modest-count modes (rigid bodies ≤ 400, cloth/spring networks of a few
 * hundred nodes, small particle scenes) cast crisp shadows that ground them on the floor.
 *
 * High-count modes (fluids ~1–2k, the generic particle path up to 20k, the GPU N-body at 100k via
 * a separate component) skip per-instance casting entirely: they still receive the IBL fill and
 * sit on the (always shadow-receiving) ground plane, so they're lit and grounded without the cost.
 *
 * 512 sits comfortably above the rigid-body (400) and typical cloth/spring node counts while well
 * below the fluid/particle scales, giving a clean split between "casts" and "doesn't".
 *
 * Invariant for new modes: no shipped mode's *adjustable* count range should straddle this value,
 * or shadows would pop in/out as the user drags the count slider across it. If a future mode needs
 * a range that crosses 512, gate on a stable per-mode property (capacity) rather than live count.
 */
export const SHADOW_CASTER_MAX_COUNT = 512
