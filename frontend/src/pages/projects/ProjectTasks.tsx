import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { createTask, listObjectives, listTasks, type CurrentUser, type Project } from '../../api/client';
import { canCreateWork, teamsForNewTask } from '../../auth/current-user';
import { Notice } from '../../components/Notice';
import { usePageFeedback } from '../../components/PageFeedback';
import { Pager } from '@/components/pager';
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
  const announce = usePageFeedback('tasks', () => setNotice(undefined));

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
        ...(values.dueDate ? { dueDate: values.dueDate } : {}),
      }),
    onMutate: () => {
      setNotice(undefined);
      announce();
    },
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tasks-title" className="m-0 text-base font-semibold">Tarefas</h2>
          {teams.length > 0 && hasEpics && !creating ? (
            <Button
              type="button"
              onClick={() => {
                create.reset();
                setNotice(undefined);
                setCreating(true);
              }}
            >
              Nova tarefa
            </Button>
          ) : null}
        </div>

        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {creating && objectives.data ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h3 className="m-0 text-sm font-semibold">Nova tarefa</h3>
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
          <p className="m-0 text-sm text-muted-foreground">
            {project.teams.length === 0
              ? 'Este projeto ainda não tem equipas associadas; sem equipa responsável não é possível criar tarefas.'
              : 'Só cria tarefas quem pertence a uma equipa do projeto, o gestor do projeto ou o administrador.'}
          </p>
        ) : objectives.data && !hasEpics ? (
          <p className="m-0 text-sm text-muted-foreground">Para criar tarefas, o projeto precisa de um objetivo com pelo menos um épico (RN12).</p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 [&>*]:min-w-48" role="group" aria-label="Filtrar tarefas">
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
            <Button variant="link" className="h-auto self-start p-0" type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Limpar filtros
            </Button>
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
            <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
              {tasks.data.total === 1 ? '1 tarefa' : `${tasks.data.total} tarefas`}
              {filtered ? ' com estes filtros' : ''}
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tasks.data.items.map((task) => (
                <li key={task.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
                  <Link to={`/tarefas/${task.id}`} className="font-semibold text-foreground hover:underline">
                    {task.title}
                  </Link>
                  <p className="m-0 text-sm text-foreground/80">
                    <TaskBadges state={task.state} priority={task.priority} isBlocked={task.isBlocked} isOverdue={task.isOverdue} />
                  </p>
                  <p className="m-0 text-sm text-muted-foreground">
                    {teamName.get(task.teamId) ?? 'Equipa'}
                    {task.assignee ? ` · ${task.assignee.name}` : ' · sem responsável'}
                    {task.subtaskCount > 0 ? ` · ${task.subtaskCount === 1 ? '1 subtarefa' : `${task.subtaskCount} subtarefas`}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <Pager page={tasks.data.page} pageSize={tasks.data.pageSize} total={tasks.data.total} onPage={goToPage} />
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
