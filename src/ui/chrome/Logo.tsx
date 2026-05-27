interface LogoProps {
  className?: string
  /** Pixel size of the square mark. */
  size?: number
}

/**
 * Brand mark — three nested rings spiralling inward, an orbital "three-body" motif that nods to
 * the n-body/orbital simulations. Stroke inherits `currentColor`; it's decorative, so it's
 * aria-hidden and the adjacent "Particle Lab" wordmark carries the accessible name. The same
 * geometry is shipped as the favicon / PWA icon (public/logo.svg).
 */
export function Logo({ className, size = 22 }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12.08 15.29A 26 26 0 1 1 6 32" />
      <path d="M37.11 33.13A 15.6 15.6 0 1 1 34.6 18.95" />
      <circle cx="28.37" cy="27.36" r="9.36" />
    </svg>
  )
}
