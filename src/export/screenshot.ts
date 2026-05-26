/**
 * Capture the current canvas frame as a PNG blob (browser only). A WebGPU/WebGL canvas doesn't
 * preserve its drawing buffer for `toBlob`, so we copy the presented frame into a 2D canvas via
 * `drawImage` (which reads the current contents) and encode that. Resolves null on failure.
 */
export async function captureCanvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const { width, height } = canvas
  if (!width || !height) return null
  const copy = document.createElement('canvas')
  copy.width = width
  copy.height = height
  const ctx = copy.getContext('2d')
  if (!ctx) return null
  try {
    ctx.drawImage(canvas, 0, 0)
  } catch {
    return null
  }
  return new Promise((resolve) => copy.toBlob((blob) => resolve(blob), 'image/png'))
}
