import { startCanvasRecording, type ActiveRecording } from './recorder'
import type { RecordFormat } from './recordFormats'
import { getCanvas } from '../render/canvasBridge'
import { startRecording as lifecycleStartRecording, stopRecording as lifecycleStopRecording } from '../state/lifecycle'

/**
 * Module-level recording controller. Holds the single active recording, advances it from the
 * render loop, and keeps the lifecycle machine's `recording` phase in sync. Kept outside React
 * so the hot render loop can step it without re-renders.
 */
let active: ActiveRecording | null = null
let stepping = false

export function isRecording(): boolean {
  return active !== null
}

export async function beginRecording(format: RecordFormat): Promise<void> {
  if (active) return
  const canvas = getCanvas()
  if (!canvas) throw new Error('Canvas is not ready yet')
  active = await startCanvasRecording(canvas, format)
  lifecycleStartRecording()
}

/** Encode one frame. Called every render frame while recording; self-guards against overlap. */
export async function stepRecording(): Promise<void> {
  if (!active || stepping) return
  stepping = true
  try {
    await active.step()
  } finally {
    stepping = false
  }
}

export async function endRecording(): Promise<void> {
  const recording = active
  if (!recording) return
  active = null
  lifecycleStopRecording()
  await recording.stop()
}
