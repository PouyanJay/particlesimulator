import { useSyncExternalStore } from 'react'

/**
 * Below this viewport width the docked sidebar (320px) + measurements dock (340px) leave too
 * little room for the canvas, so the app switches to its full-bleed "compact" layout (canvas
 * fills the screen; panels become dismissible bottom sheets). This is the single source of the
 * breakpoint — `useIsCompact` reads it and `App` toggles `.app--compact` from the same value,
 * so JS layout and CSS never drift.
 */
export const COMPACT_MAX_WIDTH = 1023

/**
 * Subscribes to a CSS media query and re-renders when it starts or stops matching. Uses
 * `useSyncExternalStore` so the first render already reflects the real viewport (no flash) and
 * there's no effect-driven layout thrash. SSR-safe (returns `false` with no `window`).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True when the viewport is too narrow for the docked desktop layout (see {@link COMPACT_MAX_WIDTH}). */
export function useIsCompact(): boolean {
  return useMediaQuery(`(max-width: ${COMPACT_MAX_WIDTH}px)`)
}
