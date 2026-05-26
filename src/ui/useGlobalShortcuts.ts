import { useEffect } from 'react'
import { useParamStore } from '../state/paramStore'

/**
 * Returns true when a keyboard event originates from a control that owns the key itself
 * (text inputs, buttons, links, selects, editable regions) — so global shortcuts like
 * Space-to-play don't fire while the user is typing or operating a focused control. Range
 * sliders are exempt: arrow keys drive them, but Space/⌘Z are still global there.
 */
export function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true // editable region owns all keys
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return true
  if (tag === 'INPUT') return (el as HTMLInputElement).type !== 'range'
  return el.getAttribute('role') === 'menuitem' || el.getAttribute('role') === 'button'
}

/**
 * App-global keyboard shortcuts. Undo/redo and play/pause are available everywhere; they
 * defer to focused text controls. Mounted once at the app root.
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        const temporal = useParamStore.temporal.getState()
        if (e.shiftKey) temporal.redo()
        else temporal.undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        useParamStore.temporal.getState().redo()
        return
      }
      if ((e.key === ' ' || e.key === 'Spacebar') && !isInteractiveTarget(e.target)) {
        e.preventDefault()
        useParamStore.getState().togglePlaying()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
