import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  /** Square, icon-only button (pass an aria-label for accessibility). */
  icon?: boolean
}

/** Token-styled button primitive. Reuse everywhere instead of bespoke <button>s. */
export function Button({ variant = 'ghost', icon = false, className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, icon ? 'btn--icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button className={classes} {...rest} />
}
