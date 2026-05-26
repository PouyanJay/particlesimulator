import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
}

/** Labelled single-line text input primitive, token-styled. */
export function TextField({ label, value, onChange, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <div className="textfield">
      <label className="textfield__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="textfield__input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  )
}
