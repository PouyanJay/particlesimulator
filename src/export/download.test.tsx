import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadText, triggerDownload } from './download'

describe('download helpers (jsdom)', () => {
  const createObjectURL = vi.fn(() => 'blob:fake-url')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    // jsdom does not implement the object-URL API; stub it.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloadText creates and clicks an anchor with the right download attribute', () => {
    const clicked: HTMLAnchorElement[] = []
    const realCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        vi.spyOn(anchor, 'click').mockImplementation(() => {
          clicked.push(anchor)
        })
      }
      return el
    })

    downloadText('report.csv', 'sample,value\n0,1\n', 'text/csv;charset=utf-8')

    expect(createSpy).toHaveBeenCalledWith('a')
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('report.csv')
    expect(clicked[0].href).toBe('blob:fake-url')
    // anchor must not linger in the DOM
    expect(document.body.contains(clicked[0])).toBe(false)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })

  it('downloadText defaults the mime type to text/plain', () => {
    let capturedBlob: Blob | undefined
    createObjectURL.mockImplementation((blob?: Blob) => {
      capturedBlob = blob
      return 'blob:fake-url'
    })

    downloadText('notes.txt', 'hello')

    expect(capturedBlob).toBeInstanceOf(Blob)
    expect(capturedBlob?.type).toBe('text/plain;charset=utf-8')
  })

  it('triggerDownload appends, clicks, removes the anchor and revokes the URL', () => {
    let appended = false
    let removedAfterClick = false
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        vi.spyOn(anchor, 'click').mockImplementation(() => {
          // at click time the anchor must already be in the document
          appended = document.body.contains(anchor)
        })
      }
      return el
    })

    const blob = new Blob(['x'], { type: 'text/plain' })
    triggerDownload('file.txt', blob)

    removedAfterClick = revokeObjectURL.mock.calls.length === 1
    expect(appended).toBe(true)
    expect(removedAfterClick).toBe(true)
  })
})
