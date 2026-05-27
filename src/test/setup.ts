// Registers jest-dom matchers (toBeInTheDocument, toHaveFocus, ...) on Vitest's expect,
// and unmounts React trees between component tests. Unit tests run in the node
// environment (no document), so the RTL cleanup is guarded.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

// jsdom doesn't implement matchMedia, which our responsive hooks rely on. Provide a
// non-matching default with a working listener API so components render; tests that
// exercise responsive behaviour stub `window.matchMedia` themselves.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
