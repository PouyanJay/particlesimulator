import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, CheckIcon } from '../icons'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** Accessible name for the trigger button (e.g. "Simulation mode"). */
  ariaLabel: string
}

/**
 * A custom menu-button dropdown (not a native <select>) so the menu always opens downward
 * and matches the design tokens. Shared primitive — used for the mode selector and the
 * display-units selector. Closes on selection, outside click, or Escape.
 */
export function Select({ value, options, onChange, ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

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
    <div className="dropdown" ref={containerRef}>
      <button
        type="button"
        className="select"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current?.label}</span>
        <ChevronDownIcon className="select__chevron" />
      </button>
      {open && (
        <div className="dropdown__menu" role="menu">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                className={`dropdown__option${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="dropdown__check">{selected ? <CheckIcon /> : null}</span>
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
