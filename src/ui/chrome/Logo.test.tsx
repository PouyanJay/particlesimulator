import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders a decorative svg mark (the wordmark beside it is the label)', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('inherits color via currentColor so the brand context sets the accent', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor')
  })

  it('forwards a className and size', () => {
    const { container } = render(<Logo className="brand" size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('brand')
    expect(svg).toHaveAttribute('width', '32')
  })
})
