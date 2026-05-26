/**
 * Lazy loader for the Rapier physics engine — the one heavy, async dependency in the lab.
 *
 * Rapier (`@dimforge/rapier3d-compat`) ships its WASM inlined as base64 in the JS bundle and
 * must be asynchronously initialised (`RAPIER.init()`) before any world/body can be created.
 * Two problems to solve:
 *   1. **Bundle size** — statically importing it would inline ~MB of base64 WASM into the main
 *      chunk for every user, even those who never open the rigid-body sandbox. We therefore load
 *      it via a **dynamic `import()`**, so the bundler code-splits it into its own chunk fetched
 *      only when the sandbox is selected.
 *   2. **Sync `SimMode.init`** — the plugin contract initialises modes synchronously, but Rapier
 *      init is async. The render layer awaits `ensureRapierReady()` (mirroring how the canvas
 *      awaits `renderer.init()`) before loading a rigid-body scenario; the mode then pulls the
 *      ready namespace synchronously via `getRapier()`.
 *
 * The type-only import keeps the `RAPIER` *type* available with zero bundle cost; the value is
 * obtained exclusively through the dynamic import.
 */
import type RapierNamespace from '@dimforge/rapier3d-compat'

type Rapier = typeof RapierNamespace

let rapier: Rapier | null = null
let readyPromise: Promise<void> | null = null

/**
 * Idempotently load and initialise Rapier. Safe to call repeatedly — the underlying
 * import + `init()` runs once and every caller awaits the same promise.
 */
export function ensureRapierReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = import('@dimforge/rapier3d-compat').then(async (module) => {
      const loaded = module.default
      await loaded.init()
      rapier = loaded
    })
  }
  return readyPromise
}

/** True once Rapier has finished initialising and `getRapier()` is safe to call. */
export function isRapierReady(): boolean {
  return rapier !== null
}

/**
 * The initialised Rapier namespace. Throws if called before `ensureRapierReady()` has resolved —
 * a rigid-body mode must only be constructed after the engine is ready.
 */
export function getRapier(): Rapier {
  if (!rapier) {
    throw new Error('Rapier is not initialised — await ensureRapierReady() before using getRapier()')
  }
  return rapier
}
