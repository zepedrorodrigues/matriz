import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import {
  ApiError,
  getSprint,
  getTeamBacklog,
  planSprintTask,
  removeSprintTask,
  startSprint,
  updateSprintDates,
  type SprintDetail,
} from '../../api/client';
import { canStartSprint, leadsTeam, useCurrentUser } from '../../auth/current-user';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageFeedbackProvider, usePageFeedback } from '../../components/PageFeedback';
import { SPRINT_STATUS_LABEL, formatDate, validateSprintDates, workingDays } from '../../domain/sprints';
import { formatHours } from '../../domain/tasks';
import { CapacityPanel } from './CapacityPanel';
import { ProgressPanel } from './ProgressPanel';
import { DateField } from '../../components/DateField';
import { PlanningTaskRow } from './PlanningTaskRow';

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');
const LEFT_REASON = { sprint_ended: 'não concluída no fim da sprint', removed: 'retirada pelo líder', transferred: 'transferida para outra equipa' } as const;

/**
 * Ecrã Sprint (wireframe; US04: CA04.3–CA04.16; RN05, RN27, RN31, RN36, RN37): datas, dias úteis e estado;
 * «Editar datas» enquanto «Planeada»; «Iniciar sprint», confirmando ou ajustando as datas (líder ou
 * administrador); tarefas da sprint com «↩ Backlog»; backlog com «Planear →», inativo sem estimativa
 * temporal; capacidade e sobrecarga (I10, CapacityPanel). Cada ação aparece a quem a matriz o permite
 * (§3.1); a API decide sempre.
 */
export function SprintPage() {
  return (
    <PageFeedbackProvider>
      <Sprint />
    </PageFeedbackProvider>
  );
}

function Sprint() {
  const { sprintId = '' } = useParams();
  const location = useLocation();
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | undefined>((location.state as { notice?: string } | null)?.notice);
  const announce = usePageFeedback('sprint', () => setNotice(undefined));
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});

  const sprint = useQuery({ queryKey: ['sprint', sprintId], queryFn: () => getSprint(sprintId), retry: false });
  const teamId = sprint.data?.teamId ?? '';
  const backlog = useQuery({ queryKey: ['backlog', teamId, 'all'], queryFn: () => getTeamBacklog(teamId, 1, 100), enabled: teamId !== '' });

  const applied = async (updated: SprintDetail, message: string) => {
    queryClient.setQueryData(['sprint', sprintId], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['backlog', updated.teamId] }),
      queryClient.invalidateQueries({ queryKey: ['sprints', updated.teamId] }),
      queryClient.invalidateQueries({ queryKey: ['capacity', sprintId] }),
      queryClient.invalidateQueries({ queryKey: ['sprint-progress', sprintId] }),
    ]);
    setNotice(message);
  };
  const begin = () => {
    setNotice(undefined);
    announce();
    for (const m of [update, start, plan, remove]) m.reset();
  };

  const update = useMutation({
    mutationFn: () => updateSprintDates(sprintId, { startDate, endDate }),
    onMutate: begin,
    onSuccess: async (s) => {
      setEditing(false);
      await applied(s, 'Datas alteradas.');
    },
  });
  const start = useMutation({
    mutationFn: () => startSprint(sprintId, { startDate, endDate }),
    onMutate: begin,
    onSuccess: async (s) => {
      setStarting(false);
      await applied(s, `Sprint iniciada com ${s.tasks.length === 1 ? '1 tarefa' : `${s.tasks.length} tarefas`}.`);
    },
  });
  const plan = useMutation({
    mutationFn: (taskId: string) => planSprintTask(sprintId, taskId),
    onMutate: begin,
    onSuccess: (s, taskId) => applied(s, `«${s.tasks.find((x) => x.id === taskId)?.title ?? 'Tarefa'}» ${s.status === 'active' ? 'acrescentada à sprint' : 'planeada na sprint'}.`),
  });
  const remove = useMutation({
    mutationFn: (taskId: string) => removeSprintTask(sprintId, taskId),
    onMutate: begin,
    onSuccess: (s) => applied(s, s.status === 'active' ? 'Tarefa retirada: voltou ao backlog e continua a contar como planeada no início.' : 'Tarefa retirada da sprint.'),
  });

  if (sprint.isPending) return <section className="page"><Notice>A carregar a sprint…</Notice></section>;
  if (sprint.isError) {
    const status = sprint.error instanceof ApiError ? sprint.error.status : 0;
    return (
      <section className="page">
        <Notice tone="error">
          {status === 404 ? 'Esta sprint não existe.' : status === 403 ? 'Não tem acesso ao planeamento desta equipa.' : 'Não foi possível carregar a sprint.'}
        </Notice>
        <Link to="/planeamento">Voltar ao planeamento</Link>
      </section>
    );
  }

  const s = sprint.data;
  const user = me.data;
  const mayManage = user ? leadsTeam(user, s.teamId) : false;
  const mayStart = user ? canStartSprint(user, s.teamId) : false;
  const teamName = user?.teams.find((t) => t.teamId === s.teamId)?.teamName;
  const open = s.status !== 'closed';
  const inSprint = new Set(s.tasks.map((t) => t.id));
  const candidates = (backlog.data?.items ?? []).filter((t) => !inSprint.has(t.id));
  const plannedHours = s.tasks.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0);
  const plannedPoints = s.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const busy = update.isPending || start.isPending || plan.isPending || remove.isPending;
  const error = [update.error, plan.error, remove.error].find(Boolean);

  const openDates = (kind: 'edit' | 'start') => {
    begin();
    setStartDate(s.startDate);
    setEndDate(s.endDate);
    setDateErrors({});
    if (kind === 'edit') setEditing(true);
    else setStarting(true);
  };
  const submitDates = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = validateSprintDates({ startDate, endDate });
    setDateErrors(found);
    if (Object.keys(found).length === 0) update.mutate();
  };

  return (
    <section className="page">
      <p className="breadcrumbs">
        <Link to={`/planeamento?equipa=${s.teamId}`}>← Planeamento{teamName ? ` · ${teamName}` : ''}</Link>
      </p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="error">{errorText(error)}</Notice> : null}

      {editing ? (
        <form className="panel form" onSubmit={submitDates} noValidate>
          <h1>Editar datas</h1>
          <div className="form__row">
            <DateField label="Início" value={startDate} onChange={setStartDate} error={dateErrors.startDate} />
            <DateField label="Fim" value={endDate} onChange={setEndDate} error={dateErrors.endDate} hint={`${workingDays(startDate, endDate)} dias úteis`} />
          </div>
          <div className="actions">
            <button type="button" className="button--secondary" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancelar
            </button>
            <button type="submit" disabled={update.isPending}>
              {update.isPending ? 'A guardar…' : 'Guardar datas'}
            </button>
          </div>
        </form>
      ) : (
        <div className="page__header">
          <h1>
            Sprint de {formatDate(s.startDate)} a {formatDate(s.endDate)} <span className="badge">{SPRINT_STATUS_LABEL[s.status]}</span>
          </h1>
          <div className="actions">
            {mayManage && s.status === 'planned' ? (
              <button type="button" className="button--secondary" onClick={() => openDates('edit')}>
                Editar datas
              </button>
            ) : null}
            {mayStart && s.status === 'planned' ? (
              <button type="button" onClick={() => openDates('start')}>
                Iniciar sprint
              </button>
            ) : null}
          </div>
        </div>
      )}
      <p className="muted">
        {s.workingDays} dias úteis · {formatHours(plannedHours)} h planeadas · {plannedPoints} SP
        {s.tasks.some((t) => t.storyPoints === null) ? ' (há tarefas sem story points, que contam como 0)' : ''}
      </p>

      <CapacityPanel sprintId={s.id} mayAdjust={mayManage && open} />

      <ProgressPanel sprintId={s.id} />

      <section className="panel" aria-labelledby="sprint-tasks-title">
        <h2 id="sprint-tasks-title">{s.status === 'planned' ? 'Tarefas planeadas' : 'Tarefas da sprint'}</h2>
        {s.tasks.length === 0 ? (
          <p className="muted">{s.status === 'planned' ? 'Ainda não há tarefas planeadas. Pode iniciar-se sem tarefas.' : 'Sem tarefas.'}</p>
        ) : (
          <ul className="criteria">
            {s.tasks.map((t) => (
              <PlanningTaskRow
                key={t.id}
                task={t}
                extra={t.addedAfterStart ? <> <span className="badge">Acrescentada depois do início</span></> : null}
                action={
                  mayManage && open ? (
                    <button type="button" className="button--link" disabled={busy} onClick={() => remove.mutate(t.id)}>
                      ↩ Backlog
                    </button>
                  ) : null
                }
              />
            ))}
          </ul>
        )}
        {s.leftTasks.length > 0 ? (
          <>
            <h3>Saíram da sprint</h3>
            <ul className="criteria">
              {s.leftTasks.map((t) => (
                <PlanningTaskRow key={t.id} task={t} extra={<span className="muted"> · {t.leftReason ? LEFT_REASON[t.leftReason] : ''}</span>} />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {mayManage && open ? (
        <section className="panel" aria-labelledby="sprint-backlog-title">
          <h2 id="sprint-backlog-title">Backlog da equipa</h2>
          {backlog.isPending ? (
            <Notice>A carregar o backlog…</Notice>
          ) : candidates.length === 0 ? (
            <p className="muted">Sem tarefas no backlog.</p>
          ) : (
            <ul className="criteria">
              {candidates.map((t) => {
                const elsewhere = t.plannedSprintId !== null && t.plannedSprintId !== s.id;
                const reason = !t.plannable
                  ? t.estimateHours === null
                    ? 'Precisa de estimativa temporal para ser planeada (RN27).'
                    : 'Já está concluída.'
                  : elsewhere
                    ? 'Já está planeada noutra sprint.'
                    : undefined;
                return (
                  <PlanningTaskRow
                    key={t.id}
                    task={t}
                    extra={reason ? <span className="muted"> · {reason}</span> : null}
                    action={
                      <button type="button" className="button--link" disabled={busy || reason !== undefined} onClick={() => plan.mutate(t.id)}>
                        {s.status === 'active' ? 'Acrescentar →' : 'Planear →'}
                      </button>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {starting ? (
        <ConfirmDialog
          title="Iniciar sprint"
          confirmLabel="Iniciar sprint"
          busy={start.isPending}
          error={start.error ? errorText(start.error) : validateSprintDates({ startDate, endDate }).endDate}
          onConfirm={() => {
            if (Object.keys(validateSprintDates({ startDate, endDate })).length === 0) start.mutate();
          }}
          onCancel={() => setStarting(false)}
        >
          <p>
            Confirme ou ajuste as datas. As {s.tasks.length === 1 ? 'tarefa planeada passa' : `${s.tasks.length} tarefas planeadas passam`} a fazer parte da
            sprint; depois do início, as datas não podem ser alteradas.
          </p>
          <div className="form__row">
            <DateField label="Início" value={startDate} onChange={setStartDate} />
            <DateField label="Fim" value={endDate} onChange={setEndDate} hint={`${workingDays(startDate, endDate)} dias úteis`} />
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
