/**
 * Canvas/WebGL color constants. three.js materials cannot read CSS custom properties,
 * so these mirror the values in src/styles/tokens.css — keep the two in sync.
 */
export const theme = {
  bgBase: '#0b0e14',
  surface: '#12161f',
  border: '#232a37',
  accent: '#6366f1',
  textPrimary: '#e6eaf2',
  textMuted: '#7e8a9c',
  /**
   * Ground plane under the simulation (receives shadows). A touch above --bg-base so the
   * surface reads as a soft floor the bodies rest on rather than blending into the void,
   * but still dark enough that it never competes with the speed-coloured particles or
   * lifts the scene into the bloom threshold. Canvas-only; mirrors --canvas-ground.
   */
  canvasGround: '#0e131c',
} as const
