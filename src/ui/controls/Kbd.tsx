import type { ReactNode } from 'react'

/** Renders a keyboard key/shortcut hint consistently (e.g. ⌘K, Space). Reusable primitive. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
