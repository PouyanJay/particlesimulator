import { Recorder } from 'canvas-record'
import { recordFormatInfo, type RecordFormat } from './recordFormats'

/**
 * A live recording: `step()` encodes one frame (call it once per rendered frame), `stop()`
 * finalizes and triggers the download.
 */
export interface ActiveRecording {
  step(): Promise<void>
  stop(): Promise<void>
}

/**
 * Begin recording the given canvas with canvas-record (WebCodecs MP4 / WebM / GIF). We drive
 * frames manually via `step()` from the render loop so capture timing matches the fixed-step
 * sim, not wall-clock. WebGPU canvases expose no 2D context, so we hand canvas-record the
 * canvas's own GPU/WebGL context (it extracts frames via createImageBitmap regardless).
 *
 * Browser-only: canvas-record needs WebCodecs/MediaRecorder and a real canvas, so this path is
 * verified in-browser rather than headlessly.
 */
export async function startCanvasRecording(
  canvas: HTMLCanvasElement,
  format: RecordFormat,
  frameRate = 60,
): Promise<ActiveRecording> {
  const context =
    canvas.getContext('webgpu') ?? canvas.getContext('webgl2') ?? canvas.getContext('2d')
  if (!context) throw new Error('Canvas has no renderable context to record')

  const recorder = new Recorder(context as unknown as RenderingContext, {
    name: 'particle-lab',
    extension: recordFormatInfo(format).extension,
    frameRate,
    duration: Infinity, // open-ended; stopped explicitly by the user
    download: true, // canvas-record saves the file on stop
  })
  await recorder.start()

  return {
    step: () => recorder.step(),
    stop: async () => {
      await recorder.stop()
      await recorder.dispose()
    },
  }
}
