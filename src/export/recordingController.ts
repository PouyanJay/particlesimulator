import { startCanvasRecording, type ActiveRecording } from './recorder'
import type { RecordFormat } from './recordFormats'
import { getCanvas } from '../render/canvasBridge'
import { startRecording as lifecycleStartRecording, stopRecording as lifecycleStopRecording } from '../state/lifecycle'

/**
 * Module-level recording controller. Holds the single active recording and keeps the lifecycle
 * machine's `recording` phase in sync. Kept outside React so starting/stopping never depends on
 * a component being mounted.
 */
let active: ActiveRecording | null = null

export async function beginRecording(format: RecordFormat): Promise<void> {
  if (active) return
  const canvas = getCanvas()
  if (!canvas) throw new Error('The canvas is not ready yet')
  active = startCanvasRecording(canvas, format)
  lifecycleStartRecording()
}

export async function endRecording(): Promise<void> {
  const recording = active
  if (!recording) return
  active = null
  lifecycleStopRecording()
  await recording.stop()
}
