/**
 * Bridge to the live WebGPU/WebGL canvas element, registered once by the R3F <Canvas>. Lets
 * the export/record features (screenshot, video) reach the canvas without prop-drilling refs
 * through the tree. Mirrors the cameraBridge pattern.
 */
let canvas: HTMLCanvasElement | null = null

export function registerCanvas(el: HTMLCanvasElement | null): void {
  canvas = el
}

export function getCanvas(): HTMLCanvasElement | null {
  return canvas
}
