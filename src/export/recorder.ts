import { triggerDownload } from './download'
import { timestampedFilename } from './filenames'
import { mimeCandidates, extensionForMime, type RecordFormat } from './recordFormats'

/** A live recording. `stop()` finalizes the file and triggers its download. */
export interface ActiveRecording {
  stop(): Promise<void>
}

/** First MIME the browser's MediaRecorder actually supports for the requested format, else WebM. */
function pickMime(format: RecordFormat): string | undefined {
  const candidates = [...mimeCandidates(format), ...mimeCandidates('webm')]
  return candidates.find((m) => MediaRecorder.isTypeSupported(m))
}

/**
 * Record the canvas via its MediaStream. `captureStream` composites the live WebGPU/WebGL
 * frames (including post-processing) without needing a preserved drawing buffer, which is why
 * this works where pulling frames out of the GPU context directly does not. The browser encodes
 * to whichever supported codec matches the requested format, falling back to WebM.
 *
 * Browser-only (needs MediaRecorder + canvas.captureStream); verified in-browser.
 */
export function startCanvasRecording(canvas: HTMLCanvasElement, format: RecordFormat, frameRate = 60): ActiveRecording {
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
