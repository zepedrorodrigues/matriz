import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Columns3, List } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ApiError,
  changeTaskState,
  getAllTeamWork,
  getSprint,
  getSprintProgress,
  getTeamBacklog,
  planSprintTask,
  removeSprintTask,
  startSprint,
  updateSprintDates,
  type SprintDetail,
  type SprintTask,
  type TaskState,
  type WorkTotals,
} from '@/api/client';
import { canStartSprint, leadsTeam, stateTargetsFor, useCurrentUser } from '@/auth/current-user';
import { DatePicker } from '@/components/date-picker';
import { Flag, StateBadge } from '@/components/task-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BACKLOG, type BoardMove } from '@/domain/board';
import { hoursText } from '@/domain/capacity';
import { SPRINT_STATUS_LABEL, formatDate, validateSprintDates, workingDays } from '@/domain/sprints';
import { STATE_LABEL, formatHours } from '@/domain/tasks';
import { CapacityStrip } from './CapacityStrip';
import { SprintBoard, type BoardCard } from './SprintBoard';

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');
const LEFT_REASON = { sprint_ended: 'não concluída no fim da sprint', removed: 'retirada pelo líder', transferred: 'transferida para outra equipa' } as const;
const tasksText = (n: number) => (n === 1 ? '1 tarefa' : `${n} tarefas`);

/**
 * Ecrã Sprint (US04: CA04.3–CA04.16; US05; US07; RN05, RN26, RN27, RN31, RN36, RN37), na direção «B · Quadro»
 * (DT17): cabeçalho com as datas, o estado e as ações; capacidade; quadro com o backlog e uma coluna por
 * estado, ou a vista Lista com o planeado e o concluído. Cada ação aparece a quem a matriz o permite
 * (§3.1); a API decide sempre e o motivo de uma recusa é mostrado.
 */
export function SprintPage() {
  const { sprintId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const view = search.get('vista') === 'lista' ? 'list' : 'board';
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'edit' | 'start' | null>(null);

  const sprint = useQuery({ queryKey: ['sprint', sprintId], queryFn: () => getSprint(sprintId), retry: false });
  const teamId = sprint.data?.teamId ?? '';
  const backlog = useQuery({ queryKey: ['backlog', teamId, 'all'], queryFn: () => getTeamBacklog(teamId, 1, 100), enabled: teamId !== '' });
  const work = useQuery({ queryKey: ['team-work-all', teamId], queryFn: () => getAllTeamWork(teamId), enabled: teamId !== '' });

  const refresh = async (updated?: SprintDetail) => {
    if (updated) queryClient.setQueryData(['sprint', sprintId], updated);
    await Promise.all([
      updated ? undefined : queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] }),
      queryClient.invalidateQueries({ queryKey: ['backlog', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['sprints', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['capacity', sprintId] }),
      queryClient.invalidateQueries({ queryKey: ['sprint-progress', sprintId] }),
      queryClient.invalidateQueries({ queryKey: ['team-work-all', teamId] }),
    ]);
  };
  const failed = (error: unknown) => toast.error(errorText(error));

  const plan = useMutation({
    mutationFn: (taskId: string) => planSprintTask(sprintId, taskId),
    onSuccess: async (s, taskId) => {
      await refresh(s);
      toast.success(`«${s.tasks.find((x) => x.id === taskId)?.title ?? 'Tarefa'}» ${s.status === 'active' ? 'acrescentada à sprint' : 'planeada na sprint'}.`);
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: (taskId: string) => removeSprintTask(sprintId, taskId),
    onSuccess: async (s) => {
      await refresh(s);
      toast.success(s.status === 'active' ? 'Tarefa devolvida ao backlog; continua a contar como planeada no início.' : 'Tarefa devolvida ao backlog.');
    },
    onError: failed,
  });
  const move = useMutation({
    mutationFn: (input: { taskId: string; to: TaskState }) => changeTaskState(input.taskId, input.to),
    onSuccess: async (task) => {
      queryClient.setQueryData(['task', task.id], task);
      await refresh();
      toast.success(`«${task.title}» passou a «${STATE_LABEL[task.state]}».`);
    },
    onError: failed,
  });

  if (sprint.isPending) {
    return (
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <Skeleton className="h-12 w-96 max-w-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (sprint.isError) {
    const status = sprint.error instanceof ApiError ? sprint.error.status : 0;
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-10">
        <h1 className="m-0 text-xl font-bold">{status === 404 ? 'Esta sprint não existe' : status === 403 ? 'Sem acesso a esta sprint' : 'Não foi possível carregar a sprint'}</h1>
        <p className="m-0 text-muted-foreground">{status === 403 ? 'Não tem acesso ao planeamento desta equipa.' : 'Verifique o endereço ou volte ao planeamento.'}</p>
        <Button asChild variant="outline">
          <Link to="/planeamento">Voltar ao planeamento</Link>
        </Button>
      </div>
    );
  }

  const s = sprint.data;
  const user = me.data;
  const mayManage = user ? leadsTeam(user, s.teamId) : false;
  const mayStart = user ? canStartSprint(user, s.teamId) : false;
  const teamName = user?.teams.find((t) => t.teamId === s.teamId)?.teamName;
  const open = s.status !== 'closed';
  const busy = plan.isPending || remove.isPending || move.isPending;
  const flags = new Map((work.data ?? []).map((w) => [w.id, w]));
  const plannedHours = s.tasks.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0);
  const plannedPoints = s.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

  const inSprint = new Set(s.tasks.map((t) => t.id));
  const cards: BoardCard[] = [
    ...s.tasks.map((t) => ({
      ...cardBase(t, flags.get(t.id)),
      column: t.state,
      targets: user && open ? stateTargetsFor(user, { state: t.state, projectId: t.projectId, teamId: s.teamId, assignee: t.assignee }) : [],
      addedAfterStart: t.addedAfterStart,
    })),
    ...(mayManage && open
      ? (backlog.data?.items ?? [])
          .filter((t) => !inSprint.has(t.id))
          .map((t) => {
            const elsewhere = t.plannedSprintId !== null && t.plannedSprintId !== s.id;
            const notPlannableReason = !t.plannable
              ? t.estimateHours === null
                ? 'Precisa de estimativa temporal para ser planeada (RN27).'
                : 'Já está concluída.'
              : elsewhere
                ? 'Já está planeada noutra sprint.'
                : undefined;
            return { ...cardBase(t, flags.get(t.id)), column: BACKLOG, targets: [], notPlannableReason } satisfies BoardCard;
          })
      : []),
  ];

  const onMove = (card: BoardCard, m: Exclude<BoardMove, { kind: 'none' } | { kind: 'refuse' }>) => {
    if (busy) return;
    if (m.kind === 'plan') plan.mutate(card.id);
    else if (m.kind === 'remove') remove.mutate(card.id);
    else move.mutate({ taskId: card.id, to: m.to });
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <nav aria-label="Localização" className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
            <Link to={`/planeamento?equipa=${s.teamId}`} className="hover:text-foreground hover:underline">
              Sprints{teamName ? ` · ${teamName}` : ''}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span aria-current="page">Sprint</span>
          </nav>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-[22px] font-bold">
              Sprint de {formatDate(s.startDate)} a {formatDate(s.endDate)}
            </h1>
            <Badge variant="secondary" className="rounded-full">
              {SPRINT_STATUS_LABEL[s.status]}
            </Badge>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {s.workingDays} dias úteis · {tasksText(s.tasks.length)} · {formatHours(plannedHours)} h · {plannedPoints} SP
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (!v) return;
              const next = new URLSearchParams(search);
              if (v === 'list') next.set('vista', 'lista');
              else next.delete('vista');
              setSearch(next, { replace: true });
            }}
            aria-label="Vista"
            variant="outline"
          >
            <ToggleGroupItem value="board" aria-label="Quadro" className="h-10 gap-1.5 px-3">
              <Columns3 aria-hidden="true" /> Quadro
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista" className="h-10 gap-1.5 px-3">
              <List aria-hidden="true" /> Lista
            </ToggleGroupItem>
          </ToggleGroup>
          {mayManage && s.status === 'planned' ? (
            <Button variant="outline" className="h-10" onClick={() => setDialog('edit')}>
              Editar datas
            </Button>
          ) : null}
          {mayStart && s.status === 'planned' ? (
            <Button className="h-10" onClick={() => setDialog('start')}>
              Iniciar sprint
            </Button>
          ) : null}
        </div>
      </div>

      <CapacityStrip sprintId={s.id} mayAdjust={mayManage && open} />

      {view === 'board' ? (
        <>
          <SprintBoard
            cards={cards}
            showBacklog={mayManage && open}
            mayPlan={mayManage && open}
            readOnly={!open}
            busy={busy}
            onMove={onMove}
            onRefuse={(reason) => toast.warning(reason)}
          />
          {mayManage && open ? (
            <p className="m-0 text-xs text-muted-foreground">
              Arraste do backlog para a sprint para planear e de volta para retirar; entre colunas para mudar o estado. O menu de cada cartão faz o mesmo.
              {s.status === 'active' ? ' Numa sprint ativa, a tarefa retirada continua a contar como planeada no início.' : ''}
            </p>
          ) : null}
        </>
      ) : (
        <SprintList sprint={s} flags={flags} />
      )}

      {dialog ? <DatesDialog sprint={s} kind={dialog} onClose={() => setDialog(null)} onDone={refresh} /> : null}
    </div>
  );
}

type WorkFlags = { isBlocked: boolean; blockReason: string | null; isOverdue: boolean };
function cardBase(
  t: { id: string; title: string; projectName: string; parentTaskId: string | null; state: TaskState; priority: BoardCard['priority']; estimateHours: number | null; storyPoints: number | null; assignee: BoardCard['assignee'] },
  f: WorkFlags | undefined,
) {
  return {
    id: t.id,
    title: t.title,
    projectName: t.projectName,
    isSubtask: t.parentTaskId !== null,
    state: t.state,
    priority: t.priority,
    estimateHours: t.estimateHours,
    storyPoints: t.storyPoints,
    assignee: t.assignee,
    isBlocked: f?.isBlocked,
    blockReason: f?.blockReason,
    isOverdue: f?.isOverdue,
  };
}

/** Vista Lista: as tarefas da sprint em tabela, as que saíram e o planeado e o concluído (CA07.2). */
function SprintList({ sprint, flags }: { sprint: SprintDetail; flags: Map<string, WorkFlags> }) {
  const progress = useQuery({ queryKey: ['sprint-progress', sprint.id], queryFn: () => getSprintProgress(sprint.id) });
  const row = (t: SprintTask, extra?: string) => {
    const f = flags.get(t.id);
    return (
      <TableRow key={t.id}>
        <TableCell className="max-w-96">
          <Link to={`/tarefas/${t.id}`} className="font-medium text-foreground hover:underline">
            {t.title}
          </Link>
          <div className="text-xs text-muted-foreground">
            {t.projectName}
            {t.parentTaskId ? ' · Subtarefa' : ''}
            {extra ? ` · ${extra}` : ''}
          </div>
        </TableCell>
        <TableCell>
          <StateBadge state={t.state} />
        </TableCell>
        <TableCell>{t.assignee?.name ?? <span className="text-muted-foreground">Sem responsável</span>}</TableCell>
        <TableCell className="whitespace-nowrap">
          {t.estimateHours === null ? '—' : hoursText(t.estimateHours)} · {t.storyPoints === null ? 'sem SP' : `${t.storyPoints} SP`}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {f?.isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
            {f?.isOverdue ? <Flag tone="warning">Prazo ultrapassado</Flag> : null}
            {t.addedAfterStart ? <Flag tone="info">Acrescentada depois do início</Flag> : null}
          </div>
        </TableCell>
      </TableRow>
    );
  };
  const head = (
    <TableHeader>
      <TableRow>
        <TableHead>Tarefa</TableHead>
        <TableHead>Estado</TableHead>
        <TableHead>Responsável</TableHead>
        <TableHead>Estimativa</TableHead>
        <TableHead>Marcas</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="list-title" className="rounded-xl border bg-card">
        <h2 id="list-title" className="m-0 border-b px-4 py-3 text-sm font-semibold">
          {sprint.status === 'planned' ? 'Tarefas planeadas' : 'Tarefas da sprint'} · {sprint.tasks.length}
        </h2>
        {sprint.tasks.length === 0 ? (
          <p className="m-0 px-4 py-6 text-sm text-muted-foreground">
            {sprint.status === 'planned' ? 'Ainda não há tarefas planeadas. Pode iniciar-se sem tarefas.' : 'Sem tarefas.'}
          </p>
        ) : (
          <Table>
            {head}
            <TableBody>{sprint.tasks.map((t) => row(t))}</TableBody>
          </Table>
        )}
      </section>

      {sprint.leftTasks.length > 0 ? (
        <section aria-labelledby="left-title" className="rounded-xl border bg-card">
          <h2 id="left-title" className="m-0 border-b px-4 py-3 text-sm font-semibold">
            Saíram da sprint · {sprint.leftTasks.length}
          </h2>
          <Table>
            {head}
            <TableBody>{sprint.leftTasks.map((t) => row(t, t.leftReason ? LEFT_REASON[t.leftReason] : undefined))}</TableBody>
          </Table>
        </section>
      ) : null}

      <section aria-labelledby="progress-title" className="rounded-xl border bg-card p-4">
        <h2 id="progress-title" className="m-0 mb-1 text-sm font-semibold">
          Planeado e concluído
        </h2>
        {progress.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : progress.isError ? (
          <p className="m-0 text-sm text-destructive">Não foi possível carregar a comparação entre o planeado e o concluído.</p>
        ) : (
          <>
            {progress.data.status === 'planned' ? (
              <p className="m-0 mb-2 text-xs text-muted-foreground">A sprint ainda não começou: as estimativas do início ficam registadas quando for iniciada.</p>
            ) : null}
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              <Totals label="Planeado" w={progress.data.planned} />
              <Totals label="Concluído" w={progress.data.done} />
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

function Totals({ label, w }: { label: string; w: WorkTotals }) {
  const h = (v: number | null) => (v === null ? '—' : hoursText(v));
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="text-sm font-semibold">
        {label} · {tasksText(w.tasks)}
      </dt>
      <dd className="m-0 mt-1 text-xs text-muted-foreground">
        Horas: no início {h(w.startHours)} · atual {hoursText(w.currentHours)}
        <br />
        Story points: no início {w.startStoryPoints === null ? '—' : `${w.startStoryPoints} SP`} · atual {w.currentStoryPoints} SP
      </dd>
    </div>
  );
}

/** «Editar datas» (enquanto «Planeada») e «Iniciar sprint», confirmando ou ajustando as datas (RN36, CA04.9–CA04.13). */
function DatesDialog({
  sprint,
  kind,
  onClose,
  onDone,
}: {
  sprint: SprintDetail;
  kind: 'edit' | 'start';
  onClose: () => void;
  onDone: (s: SprintDetail) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(sprint.startDate);
  const [endDate, setEndDate] = useState(sprint.endDate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => (kind === 'edit' ? updateSprintDates(sprint.id, { startDate, endDate }) : startSprint(sprint.id, { startDate, endDate })),
    onSuccess: async (s) => {
      await onDone(s);
      toast.success(kind === 'edit' ? 'Datas alteradas.' : `Sprint iniciada com ${tasksText(s.tasks.length)}.`);
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    const found = validateSprintDates({ startDate, endDate });
    setErrors(found);
    if (Object.keys(found).length === 0) save.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => (o || save.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{kind === 'edit' ? 'Editar datas' : 'Iniciar sprint'}</DialogTitle>
            <DialogDescription>
              {kind === 'edit'
                ? 'As datas só podem ser alteradas enquanto a sprint está «Planeada».'
                : `Confirme ou ajuste as datas. ${sprint.tasks.length === 1 ? 'A tarefa planeada passa' : `As ${sprint.tasks.length} tarefas planeadas passam`} a fazer parte da sprint; depois do início, as datas não podem ser alteradas.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker label="Início" value={startDate} onChange={setStartDate} error={errors.startDate} />
            <DatePicker label="Fim" value={endDate} onChange={setEndDate} error={errors.endDate} hint={`${workingDays(startDate, endDate)} dias úteis`} />
          </div>
          {save.error ? (
            <p role="alert" className="m-0 text-sm font-medium text-destructive">
              {errorText(save.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'A guardar…' : kind === 'edit' ? 'Guardar datas' : 'Iniciar sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
