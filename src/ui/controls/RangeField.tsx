import { useId } from 'react'

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
}

/** Format a value with tabular precision appropriate to its step. */
function formatValue(value: number, step: number): string {
  if (Number.isInteger(step) && Number.isInteger(value)) return value.toString()
  const decimals = step < 0.01 ? 3 : 2
  return value.toFixed(decimals)
}

/** Labelled range slider with a live mono value readout. Bound to a single param. */
export function RangeField({ label, value, min, max, step = 0.01, unit, disabled, onChange }: RangeFieldProps) {
  const id = useId()
  return (
    <div className="field">
      <div className="field__header">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <span className="field__value">
          {formatValue(value, step)}
          {unit ? <span className="field__unit"> {unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        className="field__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </div>
  )
}
