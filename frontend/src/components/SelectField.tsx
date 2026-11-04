import { useId, type ReactNode } from 'react';

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}

/** Lista de escolha com a mesma estrutura do FormField: etiqueta, ajuda e erro associados ao campo. */
export function SelectField({ label, value, onChange, children, error, hint, required, disabled }: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      {hint ? (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
