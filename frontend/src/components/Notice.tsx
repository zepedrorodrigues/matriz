import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  info: { className: 'border-primary/20 bg-accent text-accent-foreground', Icon: Info },
  success: { className: 'border-success/25 bg-success-soft text-success', Icon: CircleCheck },
  warning: { className: 'border-warning/25 bg-warning-soft text-warning', Icon: TriangleAlert },
  error: { className: 'border-destructive/25 bg-danger-soft text-destructive', Icon: CircleAlert },
} as const;

/** Mensagem de estado (informação, sucesso, aviso ou erro), anunciada pelos leitores de ecrã. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  const { className, Icon } = TONES[tone];
  return (
    <p className={cn('m-0 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', className)} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
