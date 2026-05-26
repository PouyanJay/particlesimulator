// Minimal type shim for `gifenc` (ships no types). Covers only the API we use.
declare module 'gifenc' {
  export type Palette = number[][]

  export interface WriteFrameOptions {
    palette?: Palette
    /** Frame delay in milliseconds. */
    delay?: number
    transparent?: boolean
    dispose?: number
  }

  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    finish(): void
    bytes(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: { auto?: boolean }): GifEncoder
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string,
  ): Uint8Array
}
