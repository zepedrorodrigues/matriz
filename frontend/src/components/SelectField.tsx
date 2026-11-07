import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FieldShell } from './FormField';

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

/**
 * Lista de escolha com a mesma estrutura do FormField: etiqueta, ajuda e erro associados ao campo. Continua a
 * ser um `<select>` nativo (o mais acessível, e o que os testes E2E escolhem com `selectOption`), com o
 * aspeto dos restantes campos (DT17).
 */
export function SelectField({ label, value, onChange, children, error, hint, required, disabled }: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} hintId={hintId} error={error} errorId={errorId}>
      <div className="relative">
        <select
          id={id}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-input bg-card pr-9 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </FieldShell>
  );
}
