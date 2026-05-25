/** A binned, area-normalised speed distribution, comparable directly to a PDF. */
export interface SpeedHistogram {
  /** Bin centers (speed values), length binCount. */
  binCenters: number[]
  /** Probability density per bin (Σ density·binWidth ≈ fraction of samples in range). */
  density: number[]
  binWidth: number
}

/**
 * Bin the first `sampleCount` entries of `speeds` into `binCount` equal bins over
 * [0, maxSpeed], returning an area-normalised density so it can be overlaid directly on
 * the Maxwell–Boltzmann PDF. Speeds at or beyond `maxSpeed` fall into the last bin.
 */
export function computeSpeedHistogram(
  speeds: ArrayLike<number>,
  sampleCount: number,
  binCount: number,
  maxSpeed: number,
): SpeedHistogram {
  const binWidth = maxSpeed / binCount
  const binCenters = Array.from({ length: binCount }, (_, i) => (i + 0.5) * binWidth)
  const counts = new Array<number>(binCount).fill(0)

  for (let i = 0; i < sampleCount; i++) {
    const bin = Math.min(binCount - 1, Math.floor(speeds[i] / binWidth))
    if (bin >= 0) counts[bin]++
  }

  const density =
    sampleCount > 0
      ? counts.map((c) => c / (sampleCount * binWidth))
      : counts // all zero
  return { binCenters, density, binWidth }
}
