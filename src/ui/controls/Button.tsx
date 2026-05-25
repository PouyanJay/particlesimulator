import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

/** Token-styled button primitive. Reuse everywhere instead of bespoke <button>s. */
export function Button({ variant = 'ghost', className, ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant}${className ? ` ${className}` : ''}`} {...rest} />
}
