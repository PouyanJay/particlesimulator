import { describe, it, expect } from 'vitest'
import { nextRovingIndex } from './roving'

describe('nextRovingIndex', () => {
  it('moves horizontally and wraps', () => {
    expect(nextRovingIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextRovingIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextRovingIndex('ArrowLeft', 0, 3)).toBe(2)
  })

  it('ignores vertical keys in horizontal orientation (and vice versa)', () => {
    expect(nextRovingIndex('ArrowDown', 0, 3, 'horizontal')).toBeNull()
    expect(nextRovingIndex('ArrowRight', 0, 3, 'vertical')).toBeNull()
  })

  it('handles both orientations', () => {
    expect(nextRovingIndex('ArrowDown', 0, 3, 'both')).toBe(1)
    expect(nextRovingIndex('ArrowLeft', 0, 3, 'both')).toBe(2)
  })

  it('Home/End jump to the ends regardless of orientation', () => {
    expect(nextRovingIndex('Home', 2, 4)).toBe(0)
    expect(nextRovingIndex('End', 0, 4)).toBe(3)
  })

  it('returns null for non-navigation keys and empty sets', () => {
    expect(nextRovingIndex('Enter', 0, 3)).toBeNull()
    expect(nextRovingIndex('ArrowRight', 0, 0)).toBeNull()
  })
})
