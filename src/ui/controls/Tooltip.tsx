import { useId, useState, type ReactElement, cloneElement } from 'react'

interface TooltipProps {
  /** The text shown on hover/focus and exposed via aria-describedby. */
  label: string
  /** A single focusable/hoverable trigger element. */
  children: ReactElement<{
    'aria-describedby'?: string
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onFocus?: () => void
    onBlur?: () => void
  }>
}

/**
 * Lightweight tooltip: shows on hover and keyboard focus, hides on blur/leave/Escape, and
 * links the trigger to the bubble via aria-describedby so it's announced to screen readers.
 * Token-styled; no dependency.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  })

  return (
    <span className="tooltip" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      {trigger}
      {open ? (
        <span role="tooltip" id={id} className="tooltip__bubble">
          {label}
        </span>
      ) : null}
    </span>
  )
}
