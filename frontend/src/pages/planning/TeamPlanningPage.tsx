import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError, createSprint, getProject, getTeamBacklog, listTeamSprints, listTeams } from '../../api/client';
import { leadsTeam, useCurrentUser } from '../../auth/current-user';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { SelectField } from '../../components/SelectField';
import { SPRINT_STATUS_LABEL, formatDate, validateSprintDates, workingDays } from '../../domain/sprints';
import { DateField } from './DateField';
import { PlanningTaskRow } from './PlanningTaskRow';

const PAGE_SIZE = 20;

/**
 * Ecrã Planeamento da equipa (US04, US08; CA04.1–CA04.3, CA04.8, CA08.1): as sprints da equipa (criação
 * pelo líder, RN36) e o backlog — tarefas de todos os projetos que não fazem parte da sprint ativa, com as
 * planeadas assinaladas. A equipa fica no endereço. Consultam os membros da equipa, o administrador e os
 * gestores dos projetos em que a equipa participa (só leitura, F20).
 */
export function TeamPlanningPage() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const allTeams = useQuery({ queryKey: ['teams'], queryFn: listTeams, enabled: me.data?.isAdmin === true });
  // F20: o gestor vê também as equipas dos projetos que gere.
  const managed = useQueries({
    queries: (me.data?.isAdmin ? [] : (me.data?.managedProjectIds ?? [])).map((projectId) => ({
      queryKey: ['project', projectId],
      queryFn: () => getProject(projectId),
    })),
  });
  const own = (me.data?.teams ?? []).map((t) => ({ teamId: t.teamId, teamName: t.teamName }));
  const fromProjects = managed.flatMap((q) => (q.data?.teams ?? []).filter((t) => t.active).map((t) => ({ teamId: t.id, teamName: t.name })));
  const teams = me.data?.isAdmin
    ? (allTeams.data ?? []).filter((t) => t.active).map((t) => ({ teamId: t.id, teamName: t.name }))
    : [...own, ...fromProjects.filter((t, i, all) => !own.some((o) => o.teamId === t.teamId) && all.findIndex((x) => x.teamId === t.teamId) === i)];
  const teamId = params.get('equipa') ?? teams[0]?.teamId ?? '';
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sprints = useQuery({ queryKey: ['sprints', teamId], queryFn: () => listTeamSprints(teamId), enabled: teamId !== '' });
  const backlog = useQuery({
    queryKey: ['backlog', teamId, page],
    queryFn: () => getTeamBacklog(teamId, page, PAGE_SIZE),
    enabled: teamId !== '',
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: () => createSprint(teamId, { startDate, endDate }),
    onSuccess: async (sprint) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints', teamId] });
      navigate(`/sprints/${sprint.id}`, { state: { notice: 'Sprint criada.' } });
    },
  });

  if (!me.data) return null;
  const mayManage = teamId !== '' && leadsTeam(me.data, teamId);
  const plannedSprints = new Map((sprints.data ?? []).map((s) => [s.id, s]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    const found = validateSprintDates({ startDate, endDate });
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate();
  };

  return (
    <section className="page">
      <h1>Planeamento</h1>
      {teams.length === 0 ? (
        <Notice>Não pertence a nenhuma equipa: o planeamento é feito por equipa.</Notice>
      ) : (
        <>
          <SelectField
            label="Equipa"
            value={teamId}
            onChange={(v) => {
              setErrors({});
              create.reset();
              setParams(new URLSearchParams({ equipa: v }));
            }}
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </SelectField>

          <section className="panel" aria-labelledby="sprints-title">
            <h2 id="sprints-title">Sprints</h2>
            {sprints.isPending ? (
              <Notice>A carregar as sprints…</Notice>
            ) : sprints.isError ? (
              <Notice tone="error">Não foi possível carregar as sprints.</Notice>
            ) : sprints.data.length === 0 ? (
              <p className="muted">A equipa ainda não tem sprints.</p>
            ) : (
              <ul className="card-list">
                {sprints.data.map((s) => (
                  <li key={s.id} className="card">
                    <Link to={`/sprints/${s.id}`} className="card__title">
                      {formatDate(s.startDate)} a {formatDate(s.endDate)}
                    </Link>{' '}
                    <span className="badge">{SPRINT_STATUS_LABEL[s.status]}</span>
                    <p className="card__text muted">{s.workingDays} dias úteis</p>
                  </li>
                ))}
              </ul>
            )}

            {mayManage ? (
              <form className="form" onSubmit={submit} noValidate>
                <h3>Nova sprint</h3>
                {create.error ? <Notice tone="error">{create.error instanceof ApiError ? create.error.message : 'Não foi possível criar a sprint.'}</Notice> : null}
                <div className="form__row">
                  <DateField label="Início" value={startDate} onChange={setStartDate} error={errors.startDate} />
                  <DateField
                    label="Fim"
                    value={endDate}
                    onChange={setEndDate}
                    error={errors.endDate}
                    hint={startDate && endDate && startDate <= endDate ? `${workingDays(startDate, endDate)} dias úteis` : undefined}
                  />
                </div>
                <div className="actions">
                  <button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'A criar…' : 'Criar sprint'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="field__hint">Só o líder da equipa cria sprints e planeia tarefas (RN36).</p>
            )}
          </section>

          <section className="panel" aria-labelledby="backlog-title">
            <h2 id="backlog-title">Backlog{backlog.data ? ` (${backlog.data.total})` : ''}</h2>
            <p className="field__hint">Tarefas da equipa, de todos os projetos, que não fazem parte da sprint ativa.</p>
            {backlog.isPending ? (
              <Notice>A carregar o backlog…</Notice>
            ) : backlog.isError ? (
              <Notice tone="error">Não foi possível carregar o backlog.</Notice>
            ) : backlog.data.total === 0 ? (
              <p className="muted">O backlog está vazio.</p>
            ) : (
              <>
                <ul className="criteria">
                  {backlog.data.items.map((t) => {
                    const planned = t.plannedSprintId ? plannedSprints.get(t.plannedSprintId) : undefined;
                    return (
                      <PlanningTaskRow
                        key={t.id}
                        task={t}
                        extra={
                          planned ? (
                            <>
                              {' · '}
                              <Link to={`/sprints/${planned.id}`}>planeada na sprint de {formatDate(planned.startDate)}</Link>
                            </>
                          ) : null
                        }
                      />
                    );
                  })}
                </ul>
                <Pagination
                  page={backlog.data.page}
                  pageSize={backlog.data.pageSize}
                  total={backlog.data.total}
                  onPage={(p) => setParams(new URLSearchParams({ equipa: teamId, pagina: String(p) }))}
                />
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
