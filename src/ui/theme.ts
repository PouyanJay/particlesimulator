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
} as const
