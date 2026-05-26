import { describe, it, expect } from 'vitest'
import {
  RECORD_FORMATS,
  DEFAULT_RECORD_FORMAT,
  mimeCandidates,
  extensionForMime,
  isFrameEncodedFormat,
} from './recordFormats'

describe('record formats', () => {
  it('offers mp4, webm, and gif with distinct extensions', () => {
    expect(RECORD_FORMATS.map((f) => f.format)).toEqual(['mp4', 'webm', 'gif'])
    const exts = RECORD_FORMATS.map((f) => f.extension)
    expect(new Set(exts).size).toBe(exts.length)
  })

  it('marks GIF as frame-encoded (not a MediaRecorder format)', () => {
    expect(isFrameEncodedFormat('gif')).toBe(true)
    expect(isFrameEncodedFormat('mp4')).toBe(false)
    expect(isFrameEncodedFormat('webm')).toBe(false)
  })

  it('defaults to the most widely-supported container (webm)', () => {
    expect(DEFAULT_RECORD_FORMAT).toBe('webm')
  })

  it('lists codec candidates most-preferred first', () => {
    expect(mimeCandidates('mp4')[0]).toContain('mp4')
    expect(mimeCandidates('webm')[0]).toContain('webm')
    expect(mimeCandidates('mp4').length).toBeGreaterThan(1)
  })

  it('derives the file extension from the produced MIME type', () => {
    expect(extensionForMime('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(extensionForMime('video/webm;codecs=vp9')).toBe('webm')
  })
})
