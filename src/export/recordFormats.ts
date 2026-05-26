/**
 * Video formats offered by the recorder. We record via the canvas's MediaStream + MediaRecorder
 * (the only path that reliably captures a WebGPU canvas), so the real output format is whichever
 * MIME the browser's MediaRecorder supports — we map the user's choice to candidate MIME types
 * and fall back to WebM when a codec isn't available.
 */
export type RecordFormat = 'mp4' | 'webm' | 'gif'

export interface RecordFormatInfo {
  format: RecordFormat
  label: string
  extension: string
}

export const RECORD_FORMATS: RecordFormatInfo[] = [
  { format: 'mp4', label: 'MP4 (H.264)', extension: 'mp4' },
  { format: 'webm', label: 'WebM', extension: 'webm' },
  { format: 'gif', label: 'GIF', extension: 'gif' },
]

// WebM is the most universally MediaRecorder-supported container, so it's the safe default.
export const DEFAULT_RECORD_FORMAT: RecordFormat = 'webm'

/** True for formats encoded from grabbed frames (GIF) rather than via MediaRecorder. */
export function isFrameEncodedFormat(format: RecordFormat): boolean {
  return format === 'gif'
}

/** Candidate MIME types for a MediaRecorder format, most-preferred first. Pure. */
export function mimeCandidates(format: RecordFormat): string[] {
  if (format === 'mp4') return ['video/mp4;codecs=avc1.42E01E', 'video/mp4']
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
}

/** File extension for a produced MIME type. */
export function extensionForMime(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}
