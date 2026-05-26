import { create } from 'zustand'

/** Which modal/overlay is currently open. Only one at a time. Transient (never persisted). */
export type Overlay = 'none' | 'palette' | 'presets' | 'share' | 'export' | 'scenarios' | 'challenges'

interface UiState {
  overlay: Overlay
  openOverlay: (overlay: Exclude<Overlay, 'none'>) => void
  closeOverlay: () => void
  /** Open the overlay, or close it if it's already the active one (for toggle buttons/shortcuts). */
  toggleOverlay: (overlay: Exclude<Overlay, 'none'>) => void
}

/**
 * Transient UI store coordinating which overlay (command palette, preset manager, share, …)
 * is visible. Triggers (toolbar buttons, command palette, shortcuts) and the overlays
 * themselves talk through this, so neither needs to know about the other.
 */
export const useUiStore = create<UiState>((set) => ({
  overlay: 'none',
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: 'none' }),
  toggleOverlay: (overlay) => set((s) => ({ overlay: s.overlay === overlay ? 'none' : overlay })),
}))
