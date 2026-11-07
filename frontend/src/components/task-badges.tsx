import type { ReactNode } from 'react';
import { STATE_LABEL, type TaskState } from '@/domain/tasks';
import { cn } from '@/lib/utils';

/** Cor de cada estado (index.css: --state-*), distintas também em luminosidade (RNF12). */
const STATE_CLASS: Record<TaskState, string> = {
  in_planning: 'bg-state-planning text-state-planning-foreground',
  in_technical_analysis: 'bg-state-analysis text-state-analysis-foreground',
  ready_for_development: 'bg-state-ready text-state-ready-foreground',
  in_development: 'bg-state-doing text-state-doing-foreground',
  in_testing: 'bg-state-testing text-state-testing-foreground',
  done: 'bg-state-done text-state-done-foreground',
  delivered: 'bg-state-delivered text-state-delivered-foreground',
};

/** Ponto de cor do estado, para cabeçalhos de coluna (decorativo: o nome do estado vem sempre ao lado). */
export const STATE_DOT: Record<TaskState, string> = {
  in_planning: 'bg-state-planning-foreground',
  in_technical_analysis: 'bg-state-analysis-foreground',
  ready_for_development: 'bg-state-ready-foreground',
  in_development: 'bg-state-doing-foreground',
  in_testing: 'bg-state-testing-foreground',
  done: 'bg-state-done-foreground',
  delivered: 'bg-state-delivered-foreground',
};

export function StateBadge({ state, className }: { state: TaskState; className?: string }) {
  return <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap', STATE_CLASS[state], className)}>{STATE_LABEL[state]}</span>;
}

/** Marca curta num cartão ou numa linha: bloqueio, prazo, estimativa em falta, etc. */
export function Flag({ tone, children }: { tone: 'danger' | 'warning' | 'neutral' | 'info'; children: ReactNode }) {
  const tones = {
    danger: 'bg-danger-soft text-destructive',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-muted text-muted-foreground',
    info: 'bg-accent text-accent-foreground',
  } as const;
  return <span className={cn('inline-flex items-center rounded px-1.5 py-px text-[11px] font-semibold whitespace-nowrap', tones[tone])}>{children}</span>;
}
