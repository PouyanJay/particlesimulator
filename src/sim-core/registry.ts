import type { SimBackend, SimMode, SimModeFactory } from './types'

/** A mode's listable metadata, derived from the mode itself (single source of truth). */
export interface SimModeInfo {
  id: string
  label: string
  /** Which backend renders/drives the mode — the render layer dispatches on this. */
  backend: SimBackend
}

export interface SimModeRegistry {
  /** Register a mode factory. Throws if a mode with the same id is already registered. */
  register(factory: SimModeFactory): void
  /** List registered modes for menus/selectors. */
  list(): SimModeInfo[]
  has(id: string): boolean
  /** Construct a fresh, uninitialised instance of the mode. Throws if the id is unknown. */
  create(id: string): SimMode
}

export function createRegistry(): SimModeRegistry {
  const factories = new Map<string, SimModeFactory>()
  const info = new Map<string, SimModeInfo>()

  return {
    register(factory) {
      // Construct a probe to read the mode's own id/label (no init ⇒ no allocation).
      const probe = factory()
      if (factories.has(probe.id)) {
        throw new Error(`SimMode "${probe.id}" is already registered`)
      }
      factories.set(probe.id, factory)
      info.set(probe.id, { id: probe.id, label: probe.label, backend: probe.backend })
    },
    list() {
      return [...info.values()]
    },
    has(id) {
      return factories.has(id)
    },
    create(id) {
      const factory = factories.get(id)
      if (!factory) throw new Error(`Unknown SimMode "${id}"`)
      return factory()
    },
  }
}
