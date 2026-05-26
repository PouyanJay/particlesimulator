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

  // Reset query/selection and focus the input each time the palette opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
  }, [open])

  // Keep the active index in range as the result set shrinks.
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, results.length - 1)))
  }, [results.length])

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
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(active)
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
              <li key={command.id} id={optionId(index)} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`palette__item${index === active ? ' is-active' : ''}`}
                  disabled={command.disabled}
                  onMouseMove={() => setActive(index)}
                  onClick={() => runAt(index)}
                >
                  <span className="palette__item-title">{command.title}</span>
                  {command.group ? <span className="palette__item-group">{command.group}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
