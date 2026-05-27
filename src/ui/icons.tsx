import type { ReactNode } from 'react'

/**
 * Inline SVG icons (no dependency). They inherit color via `currentColor` and are
 * marked aria-hidden — the interactive element carries the accessible label.
 */
type IconProps = { className?: string }

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5v9l7-4.5-7-4.5z" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2 2h1.5v11.5H14V15H2V2zm3 7h1.5v3H5V9zm3-4h1.5v7H8V5zm3 2h1.5v5H11V7z" />
    </svg>
  )
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3h2v10H5zM9 3h2v10H9z" />
    </svg>
  )
}

export function ResetIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  )
}

export function UndoIcon({ className }: IconProps) {
  // Classic "curved arrow pointing left" undo glyph.
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  )
}

export function RedoIcon({ className }: IconProps) {
  // Mirror of UndoIcon — curved arrow pointing right.
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function stroked(children: ReactNode, className?: string) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const CloseIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
    className,
  )

export const SearchIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>,
    className,
  )

export const ShareIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" />
    </>,
    className,
  )

export const SaveIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h7V3M8 21v-7h8v7" />
    </>,
    className,
  )

export const DownloadIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
    className,
  )

export const CameraIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M3 7h4l2-2h6l2 2h4v13H3z" />
      <circle cx="12" cy="13" r="4" />
    </>,
    className,
  )

export const RecordIcon = ({ className }: IconProps) =>
  stroked(<circle cx="12" cy="12" r="6" fill="currentColor" />, className)

export const StopIcon = ({ className }: IconProps) =>
  stroked(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />, className)

export const BookIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M4 4h11a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M4 4v14" />
    </>,
    className,
  )

export const TrashIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>,
    className,
  )

export const HelpIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <path d="M12 17h.01" />
    </>,
    className,
  )

export const GraduationIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M22 9 12 5 2 9l10 4 10-4z" />
      <path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </>,
    className,
  )

export const EditIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>,
    className,
  )

export const CommandIcon = ({ className }: IconProps) =>
  stroked(
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />,
    className,
  )

export const SlidersIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <path d="M4 6h10M18 6h2" />
      <path d="M4 12h2M10 12h10" />
      <path d="M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>,
    className,
  )

export const MoreIcon = ({ className }: IconProps) =>
  stroked(
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>,
    className,
  )
