export type RovingOrientation = 'horizontal' | 'vertical' | 'both'

/**
 * Shared roving-focus key handling for tablists, radiogroups, and segmented controls. Given a
 * keyboard key and the current index, returns the next index to activate, or null if the key
 * isn't a navigation key (so the caller can ignore it). Wraps around; Home/End jump to the ends.
 */
export function nextRovingIndex(
  key: string,
  current: number,
  count: number,
  orientation: RovingOrientation = 'horizontal',
): number | null {
  if (count <= 0) return null
  const fwd = (current + 1) % count
  const back = (current - 1 + count) % count
  const horizontal = orientation === 'horizontal' || orientation === 'both'
  const vertical = orientation === 'vertical' || orientation === 'both'

  switch (key) {
    case 'ArrowRight':
      return horizontal ? fwd : null
    case 'ArrowLeft':
      return horizontal ? back : null
    case 'ArrowDown':
      return vertical ? fwd : null
    case 'ArrowUp':
      return vertical ? back : null
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
