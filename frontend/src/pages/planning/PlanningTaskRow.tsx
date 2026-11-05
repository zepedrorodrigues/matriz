import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PlanningTask } from '../../api/client';
import { formatHours } from '../../domain/tasks';
import { TaskBadges } from '../tasks/TaskBadges';

/** Linha de uma tarefa no backlog ou numa sprint (wireframe §2): projeto, estado, responsável, horas e story points. */
export function PlanningTaskRow({ task, extra, action }: { task: PlanningTask; extra?: ReactNode; action?: ReactNode }) {
  return (
    <li className="criteria__item">
      <span>
        <Link to={`/tarefas/${task.id}`}>{task.title}</Link>
        {task.parentTaskId ? <span className="muted"> · subtarefa</span> : null}
        <span className="muted"> · {task.projectName}</span>
      </span>
      <span className="field__hint">
        <TaskBadges state={task.state} priority={task.priority} isBlocked={false} isOverdue={false} />{' '}
        {task.estimateHours === null ? 'sem estimativa temporal' : `${formatHours(task.estimateHours)} h`} ·{' '}
        {task.storyPoints === null ? 'sem SP' : `${task.storyPoints} SP`} · {task.assignee?.name ?? 'sem responsável'}
        {extra}
      </span>
      {action}
    </li>
  );
}
