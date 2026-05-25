import { useEffect, useRef, useState } from 'react'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { ChevronDownIcon, CheckIcon } from './icons'

/**
 * Switches the active simulation mode. A custom menu-button dropdown (rather than a
 * native <select>) so the menu always opens downward and matches the design tokens.
 * Options come straight from the registry; selecting one resets parameters to that
 * mode's defaults — so the whole flow needs no per-mode code (the SimMode plugin seam).
 */
export function ModeSelect() {
  const modeId = useParamStore((s) => s.modeId)
  const selectMode = useParamStore((s) => s.selectMode)
  const modes = simRegistry.list()
  const current = modes.find((m) => m.id === modeId)

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="mode-select">
      <span className="mode-select__label">Mode</span>
      <div className="dropdown" ref={containerRef}>
        <button
          type="button"
          className="select"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Simulation mode"
          onClick={() => setOpen((o) => !o)}
        >
          <span>{current?.label}</span>
          <ChevronDownIcon className="select__chevron" />
        </button>
        {open && (
          <div className="dropdown__menu" role="menu">
            {modes.map((mode) => {
              const selected = mode.id === modeId
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitem"
                  className={`dropdown__option${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    selectMode(mode.id)
                    setOpen(false)
                  }}
                >
                  <span className="dropdown__check">{selected ? <CheckIcon /> : null}</span>
                  {mode.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
