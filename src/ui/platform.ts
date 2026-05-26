/**
 * Platform-aware modifier labels for shortcut hints. The handler in useGlobalShortcuts treats
 * Cmd and Ctrl identically; these labels just make the tooltips read correctly per OS.
 */
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent ?? '')

/** e.g. "⌘" on macOS, "Ctrl+" elsewhere. */
export const MOD = isMac ? '⌘' : 'Ctrl+'

/** e.g. "⇧⌘" on macOS, "Ctrl+Shift+" elsewhere. */
export const SHIFT_MOD = isMac ? '⇧⌘' : 'Ctrl+Shift+'
