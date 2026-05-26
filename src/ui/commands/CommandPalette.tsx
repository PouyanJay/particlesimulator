import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SearchIcon } from '../icons'
import { filterCommands, type Command } from './commandModel'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Command[]
}

/**
 * Spotlight-style command palette: a filterable, keyboard-driven action list. Opens over a
 * backdrop, auto-focuses the search box, supports ↑/↓ to move, Enter to run, Esc to close.
 * Rendered in a portal. Token-styled; reuses the shared dialog backdrop.
 */
export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const optionId = (index: number) => `${baseId}-opt-${index}`

  const results = useMemo(() => filterCommands(commands, query), [commands, query])

  // Move the highlight to the next/previous *enabled* command, wrapping; disabled commands
  // (e.g. Undo with empty history) are skipped so the highlight never lands on a dead row.
  function step(from: number, dir: 1 | -1): number {
    const len = results.length
    for (let k = 1; k <= len; k++) {
      const i = (((from + dir * k) % len) + len) % len
      if (!results[i]?.disabled) return i
    }
    return from
  }

  // Reset query and focus the input on open.
  useEffect(() => {
    if (!open) return
    setQuery('')
    inputRef.current?.focus()
  }, [open])

  // When the result set changes (typing), re-anchor to the first enabled match.
  useEffect(() => {
    const first = results.findIndex((c) => !c.disabled)
    setActive(first < 0 ? 0 : first)
  }, [results])

  // Keep the highlighted option visible as the user arrows through a long list.
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]')
    // `scrollIntoView` is unimplemented in jsdom; guard so it's a no-op there.
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  function runAt(index: number): void {
    const command = results[index]
    if (!command || command.disabled) return
    onClose()
    command.run()
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => step(i, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => step(i, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(active)
    } else if (e.key === 'Tab') {
      // The input is the only focusable element; keep focus inside the modal palette.
      e.preventDefault()
    }
  }

  return createPortal(
    <div className="dialog__backdrop dialog__backdrop--top" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette__search">
          <SearchIcon className="palette__search-icon" />
          <input
            ref={inputRef}
            className="palette__input"
            type="text"
            placeholder="Type a command…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul ref={listRef} id="command-palette-list" className="palette__list" role="listbox">
          {results.length === 0 ? (
            <li className="palette__empty">No matching commands</li>
          ) : (
            results.map((command, index) => (
              <li
                key={command.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                aria-disabled={command.disabled || undefined}
                className={`palette__item${index === active ? ' is-active' : ''}${command.disabled ? ' is-disabled' : ''}`}
                onMouseMove={() => !command.disabled && setActive(index)}
                onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                onClick={() => runAt(index)}
              >
                <span className="palette__item-title">{command.title}</span>
                {command.group ? <span className="palette__item-group">{command.group}</span> : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
