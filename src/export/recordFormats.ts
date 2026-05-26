/** Video/animation formats the recorder offers. */
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

export const DEFAULT_RECORD_FORMAT: RecordFormat = 'mp4'

export function recordFormatInfo(format: RecordFormat): RecordFormatInfo {
  const info = RECORD_FORMATS.find((f) => f.format === format)
  if (!info) throw new Error(`Unknown record format "${format}"`)
  return info
}
