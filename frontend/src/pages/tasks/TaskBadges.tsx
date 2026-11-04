import { PRIORITY_LABEL, STATE_LABEL, type Priority, type TaskState } from '../../domain/tasks';

/** Estado, prioridade e indicadores de uma tarefa, em pt-PT (o texto não depende só da cor). */
export function TaskBadges({
  state,
  priority,
  isBlocked,
  isOverdue,
}: {
  state: TaskState;
  priority: Priority;
  isBlocked?: boolean;
  isOverdue?: boolean;
}) {
  return (
    <span className="badges">
      <span className="badge">{STATE_LABEL[state]}</span>
      <span className={`badge badge--priority-${priority}`}>Prioridade {PRIORITY_LABEL[priority].toLowerCase()}</span>
      {isBlocked ? <span className="badge badge--warning">Bloqueada</span> : null}
      {isOverdue ? <span className="badge badge--warning">Prazo ultrapassado</span> : null}
    </span>
  );
}
