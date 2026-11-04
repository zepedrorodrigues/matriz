import { useId } from 'react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  multiline?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de formulário com etiqueta, ajuda, contador e mensagem de erro associados ao campo
 * (aria-describedby, aria-invalid), para formulários consistentes (Ficha PL 03, Ex. 7).
 */
export function FormField({ label, value, onChange, error, hint, maxLength, multiline, required, autoFocus }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint || maxLength ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    required,
    autoFocus,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {multiline ? <textarea rows={4} {...common} /> : <input type="text" {...common} />}
      {hint || maxLength ? (
        <span id={hintId} className="field__hint">
          {hint}
          {hint && maxLength ? ' · ' : ''}
          {maxLength ? `${value.trim().length}/${maxLength}` : ''}
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
