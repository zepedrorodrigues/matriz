import { Flag, StateBadge } from '@/components/task-badges';
import { PRIORITY_LABEL, type Priority, type TaskState } from '@/domain/tasks';

/** Estado, prioridade e indicadores de uma tarefa, em pt-PT (o texto não depende só da cor). */
export function TaskBadges({ state, priority, isBlocked, isOverdue }: { state: TaskState; priority: Priority; isBlocked?: boolean; isOverdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StateBadge state={state} />
      <Flag tone={priority === 'high' ? 'warning' : 'neutral'}>Prioridade {PRIORITY_LABEL[priority].toLowerCase()}</Flag>
      {isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
      {isOverdue ? <Flag tone="warning">Prazo ultrapassado</Flag> : null}
    </span>
  );
}
