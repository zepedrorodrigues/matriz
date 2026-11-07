import { useId, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/domain/sprints';
import { cn } from '@/lib/utils';

/** AAAA-MM-DD → Date local (sem fuso: é uma data de calendário). */
const toDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Campo de data em pt-PT (RNF10, DT17): mostra DD/MM/AAAA e abre um calendário com meses e dias em
 * português e semana a começar à segunda, independentemente do idioma do browser. O valor continua a ser
 * AAAA-MM-DD, como na API. Etiqueta, ajuda e erro associados ao botão (RNF12).
 */
export function DatePicker({
  label,
  value,
  onChange,
  error,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn('h-10 justify-start gap-2 font-normal', !selected && 'text-muted-foreground', error && 'border-destructive')}
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {selected ? formatDate(value) : 'Escolher data'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) onChange(toValue(date));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {hint ? (
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
