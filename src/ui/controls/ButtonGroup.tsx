import type { ReactNode } from 'react'

interface ButtonGroupProps {
  children: ReactNode
  /** Horizontal distribution of the buttons (default: packed at the start). */
  justify?: 'start' | 'end' | 'between'
}

/** A row of related actions with consistent spacing and wrapping. Reused across dialogs. */
export function ButtonGroup({ children, justify = 'start' }: ButtonGroupProps) {
  return <div className={`button-group button-group--${justify}`}>{children}</div>
}
