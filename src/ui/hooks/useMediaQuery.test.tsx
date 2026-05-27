import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useMediaQuery, useIsCompact, COMPACT_MAX_WIDTH } from './useMediaQuery'

/**
 * Builds a controllable `matchMedia` stub: it reports `initial` and lets the test flip the
 * match state and notify subscribed listeners, mirroring a viewport crossing a breakpoint.
 */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  let matches = initial
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return {
    set(next: boolean) {
      matches = next
      act(() => listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent)))
    },
  }
}

function Probe({ query }: { query: string }) {
  return <span data-testid="m">{String(useMediaQuery(query))}</span>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns the current match state on first render', () => {
    stubMatchMedia(true)
    render(<Probe query="(max-width: 600px)" />)
    expect(screen.getByTestId('m')).toHaveTextContent('true')
  })

  it('updates when the media query match changes', () => {
    const mq = stubMatchMedia(false)
    render(<Probe query="(max-width: 600px)" />)
    expect(screen.getByTestId('m')).toHaveTextContent('false')
    mq.set(true)
    expect(screen.getByTestId('m')).toHaveTextContent('true')
  })
})

describe('useIsCompact', () => {
  it('tracks the compact breakpoint', () => {
    const calls: string[] = []
    window.matchMedia = ((q: string) => {
      calls.push(q)
      return {
        matches: true,
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }
    }) as unknown as typeof window.matchMedia

    function CompactProbe() {
      return <span data-testid="c">{String(useIsCompact())}</span>
    }
    render(<CompactProbe />)
    expect(screen.getByTestId('c')).toHaveTextContent('true')
    expect(calls.some((q) => q.includes(`${COMPACT_MAX_WIDTH}px`))).toBe(true)
  })
})
