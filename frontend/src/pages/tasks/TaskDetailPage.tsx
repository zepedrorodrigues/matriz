import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  ApiError,
  changeTaskState,
  createTask,
  deleteTask,
  getProject,
  getTask,
  updateTask,
  type Task,
  type TaskTransfer,
  type TaskUpdate,
} from '../../api/client';
import { canCreateSubtask, canEditEstimates, canEditTask, leadsTask, stateTargetsFor, useCurrentUser } from '../../auth/current-user';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { STATE_LABEL, formatHours, type TaskState } from '../../domain/tasks';
import { AssignmentPanel } from './AssignmentPanel';
import { BlockPanel } from './BlockPanel';
import { CommentsPanel } from './CommentsPanel';
import { CriteriaPanel } from './CriteriaPanel';
import { TaskBadges } from './TaskBadges';
import { TaskForm, type TaskFormValues } from './TaskForm';
import { TransferPanel } from './TransferPanel';

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' });
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');

/**
 * Ecrã Detalhe da tarefa (Ficha PL 03, Ex. 5 e Ex. 7): dados, edição (com as estimativas, I5), estado,
 * prioridade, subtarefas, critérios de aceitação (I5), responsável e participantes (I6), comentários
 * (I7), transferência para outra equipa (I12) e eliminação com confirmação. Cada ação aparece a quem a matriz o permite (§3.1); a API
 * decide sempre e a interface mostra o motivo de uma recusa.
 */
export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [target, setTarget] = useState<TaskState | ''>('');
  const [notice, setNotice] = useState<string | undefined>((location.state as { notice?: string } | null)?.notice);
  const [criteriaResetKey, setCriteriaResetKey] = useState(0);
  const [assignmentResetKey, setAssignmentResetKey] = useState(0);
  const [commentsResetKey, setCommentsResetKey] = useState(0);
  const [blockResetKey, setBlockResetKey] = useState(0);
  const [transferResetKey, setTransferResetKey] = useState(0);

  const task = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId), retry: false });
  const projectId = task.data?.projectId;
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: projectId !== undefined,
  });

  /**
   * Ao iniciar uma operação, apaga-se o resultado das anteriores: uma mensagem de sucesso ou um erro
   * antigo não pode ficar visível ao lado do resultado da nova operação (Ex. 8, caso 09).
   */
  const startOperation = (
    current: 'update' | 'move' | 'addSubtask' | 'remove' | 'criteria' | 'assignment' | 'comments' | 'block' | 'transfer',
  ) => {
    setNotice(undefined);
    if (current !== 'transfer') setTransferResetKey((n) => n + 1);
    if (current !== 'block') setBlockResetKey((n) => n + 1);
    if (current !== 'criteria') setCriteriaResetKey((n) => n + 1);
    if (current !== 'assignment') setAssignmentResetKey((n) => n + 1);
    if (current !== 'comments') setCommentsResetKey((n) => n + 1);
    if (current !== 'update') update.reset();
    if (current !== 'move') move.reset();
    if (current !== 'addSubtask') addSubtask.reset();
    if (current !== 'remove') remove.reset();
  };

  /** A resposta da API substitui a tarefa em cache; listagens, totais e a tarefa principal são recarregados. */
  const applyChange = async (updated: Task, message: string) => {
    queryClient.setQueryData(['task', updated.id], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', updated.projectId] }),
      updated.parentTaskId ? queryClient.invalidateQueries({ queryKey: ['task', updated.parentTaskId] }) : null,
    ]);
    setNotice(message);
  };

  /** A transferência muda a equipa da tarefa e das subtarefas (e pode retirar o responsável): recarrega-se tudo. */
  const applyTransfer = async (result: TaskTransfer, message: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', result.taskId] }),
      ...result.transferredSubtaskIds.map((id) => queryClient.invalidateQueries({ queryKey: ['task', id] })),
      queryClient.invalidateQueries({ queryKey: ['tasks', task.data?.projectId] }),
      // A tarefa sai do backlog, da sprint e da capacidade de uma equipa e entra no backlog da outra (revisão do I14).
      ...['backlog', 'sprint', 'sprints', 'sprint-progress', 'capacity', 'team-work'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    ]);
    setNotice(message);
  };

  const update = useMutation({
    mutationFn: (input: TaskUpdate) => updateTask(taskId, input),
    onMutate: () => startOperation('update'),
    onSuccess: async (updated) => {
      await applyChange(updated, 'Alterações guardadas.');
      setEditing(false);
    },
  });

  const move = useMutation({
    mutationFn: (state: TaskState) => changeTaskState(taskId, state),
    onMutate: () => startOperation('move'),
    onSuccess: async (updated) => {
      setTarget('');
      await applyChange(updated, `Estado alterado para «${STATE_LABEL[updated.state]}».`);
    },
  });

  const addSubtask = useMutation({
    onMutate: () => startOperation('addSubtask'),
    mutationFn: (values: TaskFormValues) =>
      createTask(task.data!.projectId, {
        parentTaskId: taskId,
        title: values.title,
        priority: values.priority,
        ...(values.description ? { description: values.description } : {}),
        ...(values.estimateHours !== null ? { estimateHours: values.estimateHours } : {}),
        ...(values.storyPoints !== null ? { storyPoints: values.storyPoints } : {}),
        ...(values.dueDate ? { dueDate: values.dueDate } : {}),
      }),
    onSuccess: async (created) => {
      queryClient.setQueryData(['task', created.id], created);
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      await queryClient.invalidateQueries({ queryKey: ['tasks', created.projectId] });
      setAddingSubtask(false);
      setNotice(`Subtarefa «${created.title}» criada.`);
    },
  });

  const remove = useMutation({
    onMutate: () => startOperation('remove'),
    mutationFn: () => deleteTask(taskId),
    onSuccess: async () => {
      const t = task.data!;
      queryClient.removeQueries({ queryKey: ['task', taskId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', t.projectId] }),
        t.parentTaskId ? queryClient.invalidateQueries({ queryKey: ['task', t.parentTaskId] }) : null,
      ]);
      const back = t.parentTaskId ? `/tarefas/${t.parentTaskId}` : `/projetos/${t.projectId}`;
      navigate(back, { replace: true, state: { notice: t.parentTaskId ? 'Subtarefa eliminada.' : 'Tarefa eliminada.' } });
    },
  });

  if (task.isPending) return <section className="page"><Notice>A carregar a tarefa…</Notice></section>;

  if (task.isError) {
    const status = task.error instanceof ApiError ? task.error.status : 0;
    return (
      <section className="page">
        <Notice tone="error">
          {status === 404
            ? 'Esta tarefa não existe ou foi eliminada.'
            : status === 403
              ? 'Não tem acesso a esta tarefa.'
              : 'Não foi possível carregar a tarefa. Tente novamente mais tarde.'}
        </Notice>
        <Link to="/projetos">Voltar aos projetos</Link>
      </section>
    );
  }

  const t = task.data;
  const user = me.data;
  const mayEdit = user ? canEditTask(user, t) : false;
  const mayLead = user ? leadsTask(user, t) : false;
  const targets = user ? stateTargetsFor(user, t) : [];
  const teamName = project.data?.teams.find((team) => team.id === t.teamId)?.name ?? '—';
  // RN14, CA09.2: a equipa em que a tarefa foi criada, quando já não é a responsável.
  const originalTeamName = project.data?.teams.find((team) => team.id === t.originalTeamId)?.name ?? 'equipa que já não participa no projeto';
  const isSubtask = t.parentTaskId !== null;
  // RN22: numa tarefa com subtarefas, a estimativa é a soma das subtarefas; RN10: proteção em desenvolvimento.
  const hasSubtasks = t.subtasks.length > 0;
  const mayEstimate = user ? canEditEstimates(user, t) && !hasSubtasks : false;
  const estimatesHint = hasSubtasks
    ? 'A estimativa de uma tarefa com subtarefas é a soma das estimativas das subtarefas.'
    : 'Depois de a tarefa entrar em «A desenvolver», só o líder da equipa, o gestor do projeto e o administrador alteram as estimativas.';

  const saveEdit = (values: TaskFormValues) => {
    const input: TaskUpdate = {};
    if (values.title !== t.title) input.title = values.title;
    if (values.description !== (t.description ?? '')) input.description = values.description || null;
    if (mayLead && values.priority !== t.priority) input.priority = values.priority;
    if (mayEstimate && values.estimateHours !== t.estimateHours) input.estimateHours = values.estimateHours;
    if (mayEstimate && values.storyPoints !== t.storyPoints) input.storyPoints = values.storyPoints;
    if (mayLead && values.dueDate !== t.dueDate) input.dueDate = values.dueDate;
    if (Object.keys(input).length === 0) {
      setEditing(false);
      return;
    }
    update.mutate(input);
  };

  return (
    <section className="page">
      <p className="breadcrumbs">
        <Link to={`/projetos/${t.projectId}`}>← {project.data?.name ?? 'Projeto'}</Link>
        {isSubtask ? (
          <>
            {' · '}
            <Link to={`/tarefas/${t.parentTaskId}`}>Tarefa principal</Link>
          </>
        ) : null}
      </p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {editing ? (
        <div className="panel">
          <h1>{isSubtask ? 'Editar subtarefa' : 'Editar tarefa'}</h1>
          <TaskForm
            initial={{
              title: t.title,
              description: t.description ?? '',
              priority: t.priority,
              estimateHours: t.estimateHours,
              storyPoints: t.storyPoints,
              dueDate: t.dueDate,
            }}
            dueDateEditable={mayLead}
            priorityEditable={mayLead}
            estimatesEditable={mayEstimate}
            estimatesHint={estimatesHint}
            submitLabel="Guardar alterações"
            busyLabel="A guardar…"
            busy={update.isPending}
            error={update.error}
            onSubmit={saveEdit}
            onCancel={() => {
              update.reset();
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <div className="page__header">
            <h1>
              {isSubtask ? <span className="muted">Subtarefa · </span> : null}
              {t.title}
            </h1>
            {mayEdit || mayLead ? (
              <div className="actions">
                {mayEdit ? (
                  <button
                    type="button"
                    className="button--secondary"
                    onClick={() => {
                      setNotice(undefined);
                      setEditing(true);
                    }}
                  >
                    Editar
                  </button>
                ) : null}
                {mayLead ? (
                  <button type="button" className="button--danger" onClick={() => setConfirming(true)}>
                    Eliminar
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <TaskBadges state={t.state} priority={t.priority} isBlocked={t.isBlocked} isOverdue={t.isOverdue} />

          <dl className="profile">
            <dt>Descrição</dt>
            <dd>{t.description ?? <span className="muted">Sem descrição.</span>}</dd>
            <dt>Equipa responsável</dt>
            <dd>{teamName}</dd>
            {t.originalTeamId !== t.teamId ? (
              <>
                <dt>Equipa original</dt>
                <dd>{originalTeamName}</dd>
              </>
            ) : null}
            <dt>Responsável pela execução</dt>
            <dd>{t.assignee?.name ?? <span className="muted">Sem responsável.</span>}</dd>
            <dt>Estimativa</dt>
            <dd>
              {t.estimateHours === null ? 'sem estimativa temporal' : `${formatHours(t.estimateHours)} h`} ·{' '}
              {t.storyPoints === null ? 'sem story points' : `${t.storyPoints} SP`}
              {hasSubtasks ? <span className="muted"> (somas das subtarefas, apresentadas em separado)</span> : null}
            </dd>
            <dt>Prazo</dt>
            <dd>{t.dueDate ? date.format(new Date(`${t.dueDate}T00:00:00`)) : '—'}</dd>
            {t.isBlocked ? (
              <>
                <dt>Motivo do bloqueio</dt>
                <dd>{t.blockReason}</dd>
              </>
            ) : null}
            <dt>Criada por</dt>
            <dd>
              {t.createdBy.name} · {dateTime.format(new Date(t.createdAt))}
            </dd>
          </dl>

          {targets.length > 0 ? (
            <form
              className="panel form form--inline"
              onSubmit={(e) => {
                e.preventDefault();
                if (target && !move.isPending) move.mutate(target);
              }}
            >
              <h2>Estado</h2>
              {move.error ? <Notice tone="error">{errorText(move.error)}</Notice> : null}
              <div className="form__row">
                <SelectField
                  label={`Mudar de «${STATE_LABEL[t.state]}» para`}
                  value={target}
                  onChange={(v) => {
                    move.reset();
                    setTarget(v as TaskState);
                  }}
                  hint="Avança-se um estado de cada vez e pode recuar-se para qualquer estado anterior."
                >
                  <option value="">Escolha o novo estado</option>
                  {targets.map((s) => (
                    <option key={s} value={s}>
                      {STATE_LABEL[s]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="actions">
                <button type="submit" disabled={!target || move.isPending}>
                  {move.isPending ? 'A mudar…' : 'Mudar estado'}
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}

      {!isSubtask ? (
        <section className="panel" aria-labelledby="subtasks-title">
          <div className="page__header">
            <h2 id="subtasks-title">Subtarefas</h2>
            {user && canCreateSubtask(user, t) && !addingSubtask ? (
              <button
                type="button"
                className="button--secondary"
                onClick={() => {
                  addSubtask.reset();
                  setAddingSubtask(true);
                }}
              >
                Nova subtarefa
              </button>
            ) : null}
          </div>
          {addingSubtask ? (
            <TaskForm
              submitLabel="Criar subtarefa"
              busyLabel="A criar…"
              busy={addSubtask.isPending}
              error={addSubtask.error}
              onSubmit={(values) => addSubtask.mutate(values)}
              onCancel={() => setAddingSubtask(false)}
            />
          ) : null}
          {t.subtasks.length === 0 ? (
            <p className="muted">Sem subtarefas.</p>
          ) : (
            <ul className="card-list">
              {t.subtasks.map((s) => (
                <li key={s.id} className="card">
                  <Link to={`/tarefas/${s.id}`} className="card__title">
                    {s.title}
                  </Link>
                  <p className="card__text">
                    <TaskBadges state={s.state} priority={s.priority} isBlocked={s.isBlocked} isOverdue={s.isOverdue} />
                  </p>
                  <p className="card__text muted">
                    {s.estimateHours === null ? 'sem estimativa temporal' : `${formatHours(s.estimateHours)} h`} ·{' '}
                    {s.storyPoints === null ? 'sem story points' : `${s.storyPoints} SP`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <BlockPanel task={t} me={user} onOperationStart={() => startOperation('block')} resetKey={blockResetKey} onChanged={applyChange} />

      <CriteriaPanel
        task={t}
        me={user}
        resetKey={criteriaResetKey}
        onOperationStart={() => startOperation('criteria')}
      />

      <AssignmentPanel
        task={t}
        me={user}
        resetKey={assignmentResetKey}
        onOperationStart={() => startOperation('assignment')}
      />

      <TransferPanel
        task={t}
        project={project.data}
        me={user}
        resetKey={transferResetKey}
        onOperationStart={() => startOperation('transfer')}
        onTransferred={applyTransfer}
      />

      <CommentsPanel taskId={t.id} resetKey={commentsResetKey} onOperationStart={() => startOperation('comments')} />

      {confirming ? (
        <ConfirmDialog
          title={isSubtask ? 'Eliminar subtarefa' : 'Eliminar tarefa'}
          confirmLabel={isSubtask ? 'Eliminar subtarefa' : 'Eliminar tarefa'}
          busy={remove.isPending}
          error={remove.error ? errorText(remove.error) : undefined}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            remove.reset();
            setConfirming(false);
          }}
        >
          <p>
            {isSubtask ? 'A subtarefa' : 'A tarefa'} «{t.title}»
            {t.subtasks.length > 0 ? ' e as suas subtarefas deixam' : ' deixa'} de aparecer nas listagens e contagens. O histórico
            mantém-se.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
