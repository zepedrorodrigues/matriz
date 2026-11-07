import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
 * (aria-describedby, aria-invalid), para formulários consistentes (Ficha PL 03, Ex. 7; aspeto DT17).
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
    <FieldShell id={id} label={label} required={required} hintId={hintId} errorId={errorId} error={error} hint={hint || maxLength ? <>
      {hint}
      {hint && maxLength ? ' · ' : ''}
      {maxLength ? `${value.trim().length}/${maxLength}` : ''}
    </> : undefined}>
      {multiline ? <Textarea rows={4} className="bg-card" {...common} /> : <Input type="text" className="h-10 bg-card" {...common} />}
    </FieldShell>
  );
}

/** Estrutura comum dos campos: etiqueta (com * nos obrigatórios), controlo, ajuda e erro. */
export function FieldShell({
  id,
  label,
  required,
  hint,
  hintId,
  error,
  errorId,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  hintId: string;
  error?: string;
  errorId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
