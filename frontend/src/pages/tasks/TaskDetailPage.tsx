import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
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
} from '@/api/client';
import { canCreateSubtask, canEditEstimates, canEditTask, leadsTask, stateTargetsFor, useCurrentUser } from '@/auth/current-user';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Flag, StateBadge } from '@/components/task-badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { PRIORITY_LABEL, STATE_LABEL, formatHours, type TaskState } from '@/domain/tasks';
import { AssignmentPanel } from './AssignmentPanel';
import { BlockPanel } from './BlockPanel';
import { CommentsPanel } from './CommentsPanel';
import { CriteriaPanel } from './CriteriaPanel';
import { TaskForm, type TaskFormValues } from './TaskForm';
import { TransferPanel } from './TransferPanel';

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' });
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');

/** Ecrã Detalhe da tarefa em página inteira (`/tarefas/:taskId`): ligações diretas e partilhadas. */
export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
      <TaskDetail key={taskId} taskId={taskId} />
    </div>
  );
}

/**
 * Detalhe da tarefa aberto em diálogo sobre o quadro da sprint (`/sprints/:sprintId/tarefas/:taskId`, DT17):
 * o quadro continua por baixo e o endereço identifica a tarefa, que pode ser partilhada ou aberta em página
 * inteira. Fechar volta ao quadro com a mesma vista.
 */
export function SprintTaskDialog() {
  const { sprintId = '', taskId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => navigate({ pathname: `/sprints/${sprintId}`, search: location.search });
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : close())}>
      {/* Sem transform (centrado por margens): a confirmação de «Eliminar», fixa, tem de cobrir a janela e não só o diálogo. */}
      <DialogContent
        className="top-[4vh] right-0 left-0 mx-auto max-h-[92vh] translate-none! overflow-y-auto sm:max-w-6xl"
        aria-describedby={undefined}
        // Com uma confirmação aberta por cima (Eliminar, Transferir), o Escape cancela só a confirmação.
        onEscapeKeyDown={(e) => {
          if (document.querySelector('[role=alertdialog]')) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Detalhe da tarefa</DialogTitle>
        <TaskDetail key={taskId} taskId={taskId} inDialog onDeleted={close} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Detalhe da tarefa (Ficha PL 03, Ex. 5 e Ex. 7; direção «B · Quadro», DT17): à esquerda o conteúdo —
 * descrição, subtarefas, critérios de aceitação (I5) e comentários (I7); à direita os factos e as ações —
 * detalhes, bloqueio, responsável e participantes (I6) e transferência (I12). O estado muda-se no menu do
 * cabeçalho, com os destinos de RN26. Cada ação aparece a quem a matriz o permite (§3.1); a API decide
 * sempre e a interface mostra o motivo de uma recusa.
 */
export function TaskDetail({ taskId, inDialog = false, onDeleted }: { taskId: string; inDialog?: boolean; onDeleted?: () => void }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [resetKeys, setResetKeys] = useState({ criteria: 0, assignment: 0, comments: 0, block: 0, transfer: 0 });

  // Mensagem deixada por outro ecrã ao chegar aqui (p. ex. «Tarefa criada.»).
  const arrivalNotice = (location.state as { notice?: string } | null)?.notice;
  useEffect(() => {
    if (arrivalNotice) toast.success(arrivalNotice);
  }, [arrivalNotice]);

  const task = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId), retry: false });
  const projectId = task.data?.projectId;
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId!), enabled: projectId !== undefined });

  /** Ao iniciar uma operação, os painéis apagam o resultado das anteriores (Ex. 8, caso 09). */
  type Panel = keyof typeof resetKeys;
  const startOperation = (current: Panel | 'other') =>
    setResetKeys((k) => {
      const next = { ...k };
      for (const key of Object.keys(k) as Panel[]) if (key !== current) next[key] += 1;
      return next;
    });

  /** A resposta da API substitui a tarefa em cache; listagens, quadros e a tarefa principal são recarregados. */
  const applyChange = async (updated: Task, message: string) => {
    queryClient.setQueryData(['task', updated.id], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', updated.projectId] }),
      updated.parentTaskId ? queryClient.invalidateQueries({ queryKey: ['task', updated.parentTaskId] }) : null,
      ...['sprint', 'backlog', 'capacity', 'sprint-progress', 'team-work', 'team-work-all'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    ]);
    toast.success(message);
  };

  /** A transferência muda a equipa da tarefa e das subtarefas (e pode retirar o responsável): recarrega-se tudo. */
  const applyTransfer = async (result: TaskTransfer, message: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', result.taskId] }),
      ...result.transferredSubtaskIds.map((id) => queryClient.invalidateQueries({ queryKey: ['task', id] })),
      queryClient.invalidateQueries({ queryKey: ['tasks', task.data?.projectId] }),
      // A tarefa sai do backlog, da sprint e da capacidade de uma equipa e entra no backlog da outra (revisão do I14).
      ...['backlog', 'sprint', 'sprints', 'sprint-progress', 'capacity', 'team-work', 'team-work-all'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    ]);
    toast.success(message);
  };

  const update = useMutation({
    mutationFn: (input: TaskUpdate) => updateTask(taskId, input),
    onMutate: () => startOperation('other'),
    onSuccess: async (updated) => {
      await applyChange(updated, 'Alterações guardadas.');
      setEditing(false);
    },
  });
  const move = useMutation({
    mutationFn: (state: TaskState) => changeTaskState(taskId, state),
    onMutate: () => startOperation('other'),
    onSuccess: (updated) => applyChange(updated, `Estado alterado para «${STATE_LABEL[updated.state]}».`),
    onError: (error) => toast.error(errorText(error)),
  });
  const addSubtask = useMutation({
    onMutate: () => startOperation('other'),
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
      toast.success(`Subtarefa «${created.title}» criada.`);
    },
  });
  const remove = useMutation({
    onMutate: () => startOperation('other'),
    mutationFn: () => deleteTask(taskId),
    onSuccess: async () => {
      const t = task.data!;
      queryClient.removeQueries({ queryKey: ['task', taskId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', t.projectId] }),
        t.parentTaskId ? queryClient.invalidateQueries({ queryKey: ['task', t.parentTaskId] }) : null,
        ...['sprint', 'backlog', 'capacity', 'team-work', 'team-work-all'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ]);
      const message = t.parentTaskId ? 'Subtarefa eliminada.' : 'Tarefa eliminada.';
      if (onDeleted) {
        toast.success(message);
        onDeleted();
        return;
      }
      const back = t.parentTaskId ? `/tarefas/${t.parentTaskId}` : `/projetos/${t.projectId}`;
      navigate(back, { replace: true, state: { notice: message } });
    },
  });

  if (task.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (task.isError) {
    const status = task.error instanceof ApiError ? task.error.status : 0;
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <h1 className="m-0 text-xl font-bold">
          {/* Mensagens acordadas, verificadas pelo SEC-01 (e2e/access-control.spec.ts): não se reformulam. */}
          {status === 404
            ? 'Esta tarefa não existe ou foi eliminada.'
            : status === 403
              ? 'Não tem acesso a esta tarefa.'
              : 'Não foi possível carregar a tarefa. Tente novamente mais tarde.'}
        </h1>
        <Button asChild variant="outline">
          <Link to="/projetos">Voltar aos projetos</Link>
        </Button>
      </div>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <nav aria-label="Localização" className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
          <Link to={`/projetos/${t.projectId}`} className="hover:text-foreground hover:underline">
            {project.data?.name ?? 'Projeto'}
          </Link>
          {isSubtask ? (
            <>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <Link to={`/tarefas/${t.parentTaskId}`} className="hover:text-foreground hover:underline">
                Tarefa principal
              </Link>
            </>
          ) : null}
          {inDialog ? (
            <Link to={`/tarefas/${t.id}`} className="ml-auto inline-flex items-center gap-1 pr-8 hover:text-foreground hover:underline">
              <ExternalLink className="size-3.5" aria-hidden="true" /> Abrir em página inteira
            </Link>
          ) : null}
        </nav>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <h1 className="m-0 min-w-0 flex-1 basis-80 text-[22px] leading-tight font-bold">
            {isSubtask ? <span className="font-medium text-muted-foreground">Subtarefa · </span> : null}
            {t.title}
          </h1>
          {mayEdit || mayLead ? (
            <div className="flex flex-wrap gap-2">
              {mayEdit ? (
                <Button variant="outline" className="h-10" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" /> Editar
                </Button>
              ) : null}
              {mayLead ? (
                <Button variant="outline" className="h-10 border-destructive/40 text-destructive hover:bg-danger-soft hover:text-destructive" onClick={() => setConfirming(true)}>
                  <Trash2 aria-hidden="true" /> Eliminar
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateMenu state={t.state} targets={targets} busy={move.isPending} onPick={(s) => move.mutate(s)} />
          {t.isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
          {t.isOverdue ? <Flag tone="warning">Prazo ultrapassado</Flag> : null}
          {t.priority === 'high' ? <Flag tone="warning">Prioridade alta</Flag> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <section aria-labelledby="desc-title" className="rounded-xl border bg-card p-4">
            <h2 id="desc-title" className="m-0 mb-2 text-sm font-semibold">
              Descrição
            </h2>
            {t.description ? <p className="m-0 whitespace-pre-line text-foreground/90">{t.description}</p> : <p className="m-0 text-muted-foreground">Sem descrição.</p>}
          </section>

          {!isSubtask ? (
            <section aria-labelledby="subtasks-title" className="rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <h2 id="subtasks-title" className="m-0 text-sm font-semibold">
                  Subtarefas
                </h2>
                <span className="text-sm text-muted-foreground">{t.subtasks.length}</span>
                {user && canCreateSubtask(user, t) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-9 text-primary"
                    onClick={() => {
                      addSubtask.reset();
                      setAddingSubtask(true);
                    }}
                  >
                    <Plus aria-hidden="true" /> Nova subtarefa
                  </Button>
                ) : null}
              </div>
              {t.subtasks.length === 0 ? (
                <p className="m-0 px-4 py-4 text-sm text-muted-foreground">Sem subtarefas.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {t.subtasks.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 last:border-b-0">
                      <Link to={`/tarefas/${s.id}`} className="min-w-0 flex-1 basis-60 font-medium text-foreground hover:underline">
                        {s.title}
                      </Link>
                      {s.isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
                      {s.isOverdue ? <Flag tone="warning">Prazo ultrapassado</Flag> : null}
                      <span className="text-xs text-muted-foreground">
                        {s.estimateHours === null ? 'sem estimativa' : `${formatHours(s.estimateHours)} h`}
                        {s.storyPoints === null ? '' : ` · ${s.storyPoints} SP`}
                      </span>
                      <StateBadge state={s.state} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <CriteriaPanel task={t} me={user} resetKey={resetKeys.criteria} onOperationStart={() => startOperation('criteria')} />
          <CommentsPanel taskId={t.id} resetKey={resetKeys.comments} onOperationStart={() => startOperation('comments')} />
        </div>

        <aside aria-label="Detalhes e ações" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section aria-labelledby="facts-title" className="rounded-xl border bg-card px-4 py-3">
            <h2 id="facts-title" className="m-0 mb-1 text-sm font-semibold">
              Detalhes
            </h2>
            <dl className="m-0 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] text-sm">
              <Fact label="Responsável">{t.assignee?.name ?? <span className="text-muted-foreground">Sem responsável</span>}</Fact>
              <Fact label="Equipa">{teamName}</Fact>
              {t.originalTeamId !== t.teamId ? <Fact label="Equipa original">{originalTeamName}</Fact> : null}
              <Fact label="Prioridade">{PRIORITY_LABEL[t.priority]}</Fact>
              <Fact label="Estimativa">
                {t.estimateHours === null ? 'Sem estimativa temporal' : `${formatHours(t.estimateHours)} h`} · {t.storyPoints === null ? 'sem story points' : `${t.storyPoints} SP`}
                {hasSubtasks ? <span className="block text-xs text-muted-foreground">Soma das subtarefas</span> : null}
              </Fact>
              <Fact label="Prazo">{t.dueDate ? date.format(new Date(`${t.dueDate}T00:00:00`)) : '—'}</Fact>
              <Fact label="Criada por">
                {t.createdBy.name}
                <span className="block text-xs text-muted-foreground">{dateTime.format(new Date(t.createdAt))}</span>
              </Fact>
            </dl>
          </section>
          <BlockPanel task={t} me={user} onOperationStart={() => startOperation('block')} resetKey={resetKeys.block} onChanged={applyChange} />
          <AssignmentPanel task={t} me={user} resetKey={resetKeys.assignment} onOperationStart={() => startOperation('assignment')} />
          <TransferPanel
            task={t}
            project={project.data}
            me={user}
            resetKey={resetKeys.transfer}
            onOperationStart={() => startOperation('transfer')}
            onTransferred={applyTransfer}
          />
        </aside>
      </div>

      {editing ? (
        <Dialog open onOpenChange={(open) => (open || update.isPending ? undefined : (update.reset(), setEditing(false)))}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isSubtask ? 'Editar subtarefa' : 'Editar tarefa'}</DialogTitle>
              <DialogDescription>Os campos que o seu papel não pode alterar aparecem bloqueados.</DialogDescription>
            </DialogHeader>
            <TaskForm
              initial={{ title: t.title, description: t.description ?? '', priority: t.priority, estimateHours: t.estimateHours, storyPoints: t.storyPoints, dueDate: t.dueDate }}
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
          </DialogContent>
        </Dialog>
      ) : null}

      {addingSubtask ? (
        <Dialog open onOpenChange={(open) => (open || addSubtask.isPending ? undefined : setAddingSubtask(false))}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova subtarefa</DialogTitle>
              <DialogDescription>Subtarefa de «{t.title}». A equipa é a da tarefa principal (RN22).</DialogDescription>
            </DialogHeader>
            <TaskForm
              submitLabel="Criar subtarefa"
              busyLabel="A criar…"
              busy={addSubtask.isPending}
              error={addSubtask.error}
              onSubmit={(values) => addSubtask.mutate(values)}
              onCancel={() => setAddingSubtask(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}

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
            {isSubtask ? 'A subtarefa' : 'A tarefa'} «{t.title}»{t.subtasks.length > 0 ? ' e as suas subtarefas deixam' : ' deixa'} de aparecer nas listagens e
            contagens. O histórico mantém-se.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="border-b py-2 text-muted-foreground">{label}</dt>
      <dd className="m-0 border-b py-2 font-medium">{children}</dd>
    </>
  );
}

/** Estado atual como botão que abre os destinos de RN26 (o seguinte e os anteriores; os do papel). */
function StateMenu({ state, targets, busy, onPick }: { state: TaskState; targets: TaskState[]; busy: boolean; onPick: (s: TaskState) => void }) {
  if (targets.length === 0) return <StateBadge state={state} className="px-2.5 py-1 text-sm" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 px-2.5" disabled={busy} aria-label={`Estado: ${STATE_LABEL[state]}. Mudar estado`}>
          <StateBadge state={state} />
          {busy ? 'A mudar…' : 'Mudar estado'}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Avança-se um estado de cada vez; pode recuar-se para qualquer anterior.</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {targets.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onPick(s)}>
            <StateBadge state={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
