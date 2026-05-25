import { useId } from 'react'

interface ToggleFieldProps {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/**
 * Accessible on/off switch built on a native checkbox (keyboard-operable, labelled),
 * visually styled as a switch via CSS. Reuse for all boolean parameters.
 */
export function ToggleField({ label, checked, disabled, onChange }: ToggleFieldProps) {
  const id = useId()
  return (
    <div className="field field--toggle">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="toggle"
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}
