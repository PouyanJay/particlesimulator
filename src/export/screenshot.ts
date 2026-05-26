/**
 * Capture the current canvas frame as a PNG blob (browser only). A WebGPU/WebGL canvas doesn't
 * preserve its drawing buffer, so `toBlob`/`drawImage(canvas)` often come back blank. The
 * reliable path is to grab a *composited* frame from the canvas's capture stream (the same
 * source recording uses); we fall back to a direct copy where ImageCapture isn't available.
 */
export async function captureCanvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return (await captureViaStream(canvas)) ?? (await captureViaDrawImage(canvas))
}

interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike

async function captureViaStream(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const capture = canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
  const Ctor =
    typeof window !== 'undefined'
      ? (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture
      : undefined
  if (typeof capture.captureStream !== 'function' || !Ctor) return null

  let track: MediaStreamTrack | undefined
  try {
    track = capture.captureStream().getVideoTracks()[0]
    if (!track) return null
    const bitmap = await new Ctor(track).grabFrame()
    const blob = await bitmapToPng(bitmap)
    bitmap.close?.()
    return blob
  } catch {
    return null
  } finally {
    track?.stop()
  }
}

async function bitmapToPng(bitmap: ImageBitmap): Promise<Blob | null> {
  const out = document.createElement('canvas')
  out.width = bitmap.width
  out.height = bitmap.height
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'))
}

async function captureViaDrawImage(canvas: HTMLCanvasElement): Promise<Blob | null> {
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
