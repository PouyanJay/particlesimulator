import { describe, it, expect } from 'vitest'
import { RECORD_FORMATS, DEFAULT_RECORD_FORMAT, recordFormatInfo } from './recordFormats'

describe('record formats', () => {
  it('offers mp4, webm, and gif with distinct extensions', () => {
    expect(RECORD_FORMATS.map((f) => f.format)).toEqual(['mp4', 'webm', 'gif'])
    const exts = RECORD_FORMATS.map((f) => f.extension)
    expect(new Set(exts).size).toBe(exts.length)
  })

  it('defaults to mp4 and resolves info by format', () => {
    expect(DEFAULT_RECORD_FORMAT).toBe('mp4')
    expect(recordFormatInfo('gif').extension).toBe('gif')
  })

  it('throws on an unknown format', () => {
    // @ts-expect-error — exercising the runtime guard with an invalid value
    expect(() => recordFormatInfo('avi')).toThrow()
  })
})
