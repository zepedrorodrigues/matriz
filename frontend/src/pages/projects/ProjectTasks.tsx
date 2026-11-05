import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { createTask, listObjectives, listTasks, type CurrentUser, type Project } from '../../api/client';
import { canCreateWork, teamsForNewTask } from '../../auth/current-user';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { SelectField } from '../../components/SelectField';
import { PRIORITIES, PRIORITY_LABEL, STATE_LABEL, TASK_STATES, type Priority, type TaskState } from '../../domain/tasks';
import { TaskBadges } from '../tasks/TaskBadges';
import { TaskForm, type TaskFormValues } from '../tasks/TaskForm';
import { HierarchyPanel } from './HierarchyPanel';

const PAGE_SIZE = 20;

const pick = <T extends string>(values: readonly T[], raw: string | null) => (values as readonly string[]).includes(raw ?? '') ? (raw as T) : undefined;

/**
 * Tarefas do projeto no ecrã Detalhe do projeto (Ficha PL 03, Ex. 5 e Ex. 7): listagem sem subtarefas,
 * filtros por estado e prioridade (no endereço), paginação com o total filtrado (CA03.19, D46) e
 * criação. Depois de criar, a listagem e o total atualizam-se sem recarregar a página.
 */
export function ProjectTasks({ project, me }: { project: Project; me: CurrentUser }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const state = pick<TaskState>(TASK_STATES, params.get('state'));
  const priority = pick<Priority>(PRIORITIES, params.get('priority'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string>();

  const objectives = useQuery({ queryKey: ['objectives', project.id], queryFn: () => listObjectives(project.id) });
  const tasks = useQuery({
    queryKey: ['tasks', project.id, { state, priority, page }],
    queryFn: () => listTasks(project.id, { state, priority, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (values: TaskFormValues) =>
      createTask(project.id, {
        epicId: values.epicId,
        teamId: values.teamId,
        title: values.title,
        priority: values.priority,
        ...(values.description ? { description: values.description } : {}),
        ...(values.estimateHours !== null ? { estimateHours: values.estimateHours } : {}),
        ...(values.storyPoints !== null ? { storyPoints: values.storyPoints } : {}),
      }),
    onSuccess: async (task) => {
      // A resposta confirmada pela API alimenta o detalhe; a listagem e o total são recarregados.
      queryClient.setQueryData(['task', task.id], task);
      await queryClient.invalidateQueries({ queryKey: ['tasks', project.id] });
      setCreating(false);
      setNotice(`Tarefa «${task.title}» criada.`);
    },
  });

  const setFilter = (key: 'state' | 'priority', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  const teams = teamsForNewTask(me, project);
  const teamName = new Map(project.teams.map((t) => [t.id, t.name]));
  const hasEpics = (objectives.data ?? []).some((o) => o.epics.length > 0);
  const filtered = state !== undefined || priority !== undefined;

  return (
    <>
      <section aria-labelledby="tasks-title">
        <div className="page__header">
          <h2 id="tasks-title">Tarefas</h2>
          {teams.length > 0 && hasEpics && !creating ? (
            <button
              type="button"
              onClick={() => {
                create.reset();
                setNotice(undefined);
                setCreating(true);
              }}
            >
              Nova tarefa
            </button>
          ) : null}
        </div>

        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {creating && objectives.data ? (
          <div className="panel">
            <h3>Nova tarefa</h3>
            <TaskForm
              objectives={objectives.data.filter((o) => o.epics.length > 0)}
              teams={teams}
              submitLabel="Criar tarefa"
              busyLabel="A criar…"
              busy={create.isPending}
              error={create.error}
              onSubmit={(values) => create.mutate(values)}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : null}

        {teams.length === 0 ? (
          <p className="muted">
            {project.teams.length === 0
              ? 'Este projeto ainda não tem equipas associadas; sem equipa responsável não é possível criar tarefas.'
              : 'Só cria tarefas quem pertence a uma equipa do projeto, o gestor do projeto ou o administrador.'}
          </p>
        ) : objectives.data && !hasEpics ? (
          <p className="muted">Para criar tarefas, o projeto precisa de um objetivo com pelo menos um épico (RN12).</p>
        ) : null}

        <div className="filters" role="group" aria-label="Filtrar tarefas">
          <SelectField label="Estado" value={state ?? ''} onChange={(v) => setFilter('state', v)}>
            <option value="">Todos</option>
            {TASK_STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Prioridade" value={priority ?? ''} onChange={(v) => setFilter('priority', v)}>
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
          {filtered ? (
            <button type="button" className="button--link" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Limpar filtros
            </button>
          ) : null}
        </div>

        {tasks.isPending ? (
          <Notice>A carregar as tarefas…</Notice>
        ) : tasks.isError ? (
          <Notice tone="error">Não foi possível carregar as tarefas. Tente novamente mais tarde.</Notice>
        ) : tasks.data.total === 0 ? (
          <Notice>{filtered ? 'Nenhuma tarefa corresponde aos filtros.' : 'Este projeto ainda não tem tarefas.'}</Notice>
        ) : (
          <>
            <p className="muted" aria-live="polite">
              {tasks.data.total === 1 ? '1 tarefa' : `${tasks.data.total} tarefas`}
              {filtered ? ' com estes filtros' : ''}
            </p>
            <ul className="card-list">
              {tasks.data.items.map((task) => (
                <li key={task.id} className="card">
                  <Link to={`/tarefas/${task.id}`} className="card__title">
                    {task.title}
                  </Link>
                  <p className="card__text">
                    <TaskBadges state={task.state} priority={task.priority} isBlocked={task.isBlocked} isOverdue={task.isOverdue} />
                  </p>
                  <p className="card__text muted">
                    {teamName.get(task.teamId) ?? 'Equipa'}
                    {task.assignee ? ` · ${task.assignee.name}` : ' · sem responsável'}
                    {task.subtaskCount > 0 ? ` · ${task.subtaskCount === 1 ? '1 subtarefa' : `${task.subtaskCount} subtarefas`}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination page={tasks.data.page} pageSize={tasks.data.pageSize} total={tasks.data.total} onPage={goToPage} />
          </>
        )}
      </section>

      {objectives.isError ? (
        <Notice tone="error">Não foi possível carregar os objetivos e épicos.</Notice>
      ) : objectives.data ? (
        <HierarchyPanel projectId={project.id} objectives={objectives.data} mayCreate={canCreateWork(me, project)} />
      ) : null}
    </>
  );
}
