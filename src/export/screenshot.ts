/** Capture the current canvas frame as a PNG blob (browser only). Resolves null on failure. */
export function captureCanvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}
