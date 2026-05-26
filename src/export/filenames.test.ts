import { describe, it, expect } from 'vitest'
import { timestampedFilename } from './filenames'

describe('timestampedFilename', () => {
  it('formats base-YYYY-MM-DD-HHmmss.ext in local time with zero-padding', () => {
    // Month is 0-based in Date: 4 = May. 02:05:30 must zero-pad to 020530.
    const now = new Date(2026, 4, 26, 2, 5, 30)
    expect(timestampedFilename('particle-lab', 'csv', now)).toBe(
      'particle-lab-2026-05-26-020530.csv',
    )
  })

  it('zero-pads every component (single-digit month/day/time)', () => {
    // 0 = January, day 1, 09:08:07.
    const now = new Date(2026, 0, 1, 9, 8, 7)
    expect(timestampedFilename('data', 'json', now)).toBe('data-2026-01-01-090807.json')
  })

  it('is deterministic for a given Date', () => {
    const now = new Date(2026, 11, 31, 23, 59, 59)
    const a = timestampedFilename('lab', 'csv', now)
    const b = timestampedFilename('lab', 'csv', now)
    expect(a).toBe(b)
    expect(a).toBe('lab-2026-12-31-235959.csv')
  })
})
