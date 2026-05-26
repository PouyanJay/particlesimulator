/**
 * Minimal DOM helpers for triggering a browser file download. Isolated here so the pure
 * serialization modules stay DOM-free; this is the only export-layer code that touches
 * `document`/`URL`.
 */

const DEFAULT_TEXT_MIME = 'text/plain;charset=utf-8'

/**
 * Download a Blob under `filename` via a synthetic anchor click. The anchor is appended to
 * the document before clicking (some browsers ignore clicks on detached anchors), removed
 * immediately after, and the object URL is revoked to release the blob.
 */
export function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Wrap text in a Blob (default `text/plain;charset=utf-8`) and download it as `filename`. */
export function downloadText(filename: string, text: string, mime: string = DEFAULT_TEXT_MIME): void {
  const blob = new Blob([text], { type: mime })
  triggerDownload(filename, blob)
}
