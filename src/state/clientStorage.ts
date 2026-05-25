import type { StateStorage } from 'zustand/middleware'

/**
 * Storage backend for the persist middleware. Uses `localStorage` in the browser and
 * falls back to an in-memory map elsewhere (node tests, SSR, embeds) so the stores
 * work everywhere without guarding each access.
 */
function createMemoryStorage(): StateStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

// Feature-detect a *working* localStorage: some runtimes (e.g. Node) expose a
// `localStorage` global without functional methods, so checking `typeof` is not enough.
const hasLocalStorage =
  typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'

export const clientStorage: StateStorage = hasLocalStorage
  ? {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    }
  : createMemoryStorage()
