/**
 * Builds timestamped, filesystem-safe export filenames. Deterministic given an explicit
 * `Date`, which keeps the formatting unit-testable without mocking the clock.
 */

/** Left-pad a non-negative integer to two digits (e.g. 5 → "05"). */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `${base}-YYYY-MM-DD-HHmmss.${ext}` in local time, every component zero-padded. Uses the
 * Date's local getters (not UTC) so the stamp matches the wall clock the user sees. Contains
 * only digits, hyphens and dots — no spaces or characters that are unsafe in a filename.
 *
 * e.g. timestampedFilename('particle-lab', 'csv', new Date(2026, 4, 26, 2, 5, 30))
 *      → 'particle-lab-2026-05-26-020530.csv'
 */
export function timestampedFilename(base: string, ext: string, now: Date = new Date()): string {
  const year = now.getFullYear()
  // getMonth() is 0-based; +1 to render the human month number.
  const month = pad2(now.getMonth() + 1)
  const day = pad2(now.getDate())
  const hours = pad2(now.getHours())
  const minutes = pad2(now.getMinutes())
  const seconds = pad2(now.getSeconds())
  return `${base}-${year}-${month}-${day}-${hours}${minutes}${seconds}.${ext}`
}
