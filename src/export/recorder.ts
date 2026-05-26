import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { triggerDownload } from './download'
import { timestampedFilename } from './filenames'
import { mimeCandidates, extensionForMime, isFrameEncodedFormat, type RecordFormat } from './recordFormats'

/** A live recording. `stop()` finalizes the file and triggers its download. */
export interface ActiveRecording {
  stop(): Promise<void>
}

// GIFs are small, low-frame-rate, and palette-quantized per frame, so we cap the rate and
// downscale to keep encoding cheap and file sizes sane.
const GIF_FPS = 15
const GIF_MAX_WIDTH = 480

/** First MIME the browser's MediaRecorder actually supports for the requested format, else WebM. */
function pickMime(format: RecordFormat): string | undefined {
  const candidates = [...mimeCandidates(format), ...mimeCandidates('webm')]
  return candidates.find((m) => MediaRecorder.isTypeSupported(m))
}

/**
 * Record the canvas to MP4/WebM via its MediaStream. `captureStream` composites the live
 * WebGPU/WebGL frames (including post-processing) without needing a preserved drawing buffer.
 */
function startVideoRecording(canvas: HTMLCanvasElement, format: RecordFormat, frameRate: number): ActiveRecording {
  const capture = canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
  if (typeof capture.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('Recording is not supported in this browser')
  }
  const stream = capture.captureStream(frameRate)
  const mimeType = pickMime(format)
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })
  recorder.start()

  return {
    async stop() {
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((track) => track.stop())
      await finished
      const type = recorder.mimeType || mimeType || 'video/webm'
      const blob = new Blob(chunks, { type })
      triggerDownload(timestampedFilename('particle-lab', extensionForMime(type)), blob)
    },
  }
}

/**
 * Record an animated GIF. A WebGPU canvas doesn't preserve its drawing buffer, so drawing the
 * canvas directly yields black frames; instead we pipe the canvas's composited capture stream
 * through a hidden <video> and grab frames from that (drawing a playing video to a 2D canvas is
 * reliable), then palette-quantize each frame with gifenc. MediaRecorder can't emit GIF, hence
 * this separate path. Downscaled + frame-capped to keep encoding cheap and file sizes sane.
 */
function startGifRecording(canvas: HTMLCanvasElement): ActiveRecording {
  const capture = canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
  if (typeof capture.captureStream !== 'function') {
    throw new Error('Recording is not supported in this browser')
  }
  const stream = capture.captureStream(GIF_FPS)
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  void video.play().catch(() => {})

  const scale = Math.min(1, GIF_MAX_WIDTH / Math.max(1, canvas.width))
  const width = Math.max(1, Math.round(canvas.width * scale))
  const height = Math.max(1, Math.round(canvas.height * scale))
  const frame = document.createElement('canvas')
  frame.width = width
  frame.height = height
  const ctx = frame.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create a 2D context for GIF capture')

  const gif = GIFEncoder()
  const delay = Math.round(1000 / GIF_FPS)
  let frames = 0
  const timer = setInterval(() => {
    if (video.readyState < 2 || video.videoWidth === 0) return // wait for the first decoded frame
    try {
      ctx.drawImage(video, 0, 0, width, height)
    } catch {
      return
    }
    const { data } = ctx.getImageData(0, 0, width, height)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, { palette, delay })
    frames++
  }, delay)

  return {
    async stop() {
      clearInterval(timer)
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
      if (frames === 0) return // never captured a frame — nothing to save
      gif.finish()
      triggerDownload(timestampedFilename('particle-lab', 'gif'), new Blob([gif.bytes()], { type: 'image/gif' }))
    },
  }
}

/** Begin recording the canvas in the requested format. Browser-only; verified in-browser. */
export function startCanvasRecording(canvas: HTMLCanvasElement, format: RecordFormat, frameRate = 60): ActiveRecording {
  return isFrameEncodedFormat(format)
    ? startGifRecording(canvas)
    : startVideoRecording(canvas, format, frameRate)
}
