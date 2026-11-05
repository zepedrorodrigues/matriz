import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getTeamWork, type WorkGroup } from '../../api/client';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../domain/sprints';
import { TaskBadges } from '../tasks/TaskBadges';

const GROUPS: { key: WorkGroup | undefined; label: string }[] = [
  { key: undefined, label: 'Todas' },
  { key: 'planned', label: 'Planeadas' },
  { key: 'in_progress', label: 'Em execução' },
  { key: 'done', label: 'Concluídas' },
  { key: 'blocked', label: 'Bloqueadas' },
  { key: 'overdue', label: 'Atrasadas' },
];

/**
 * Trabalho da equipa (US07; CA07.1, CA07.3, CA07.4; RF26, RF28): contagens de planeadas, em execução e
 * concluídas, e das bloqueadas e atrasadas, qualquer que seja o estado; a lista filtra por grupo, com as
 * bloqueadas (e o motivo) primeiro. As contagens são do conjunto completo, não da página.
 */
export function TeamWorkPanel({ teamId }: { teamId: string }) {
  const [group, setGroup] = useState<WorkGroup | undefined>();
  const [page, setPage] = useState(1);
  const work = useQuery({
    queryKey: ['team-work', teamId, group, page],
    queryFn: () => getTeamWork(teamId, { group, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="panel" aria-labelledby="team-work-title">
      <h2 id="team-work-title">Trabalho da equipa</h2>
      {work.isPending ? (
        <Notice>A carregar o trabalho da equipa…</Notice>
      ) : work.isError ? (
        <Notice tone="error">Não foi possível carregar o trabalho da equipa.</Notice>
      ) : (
        <>
          <div className="actions" role="group" aria-label="Filtrar por grupo">
            {GROUPS.map((g) => {
              const count = g.key ? work.data.counts[g.key] : work.data.counts.planned + work.data.counts.in_progress + work.data.counts.done;
              return (
                <button
                  key={g.label}
                  type="button"
                  className={group === g.key ? undefined : 'button--secondary'}
                  aria-pressed={group === g.key}
                  onClick={() => {
                    setGroup(g.key);
                    setPage(1);
                  }}
                >
                  {g.label} ({count})
                </button>
              );
            })}
          </div>
          {work.data.total === 0 ? (
            <p className="muted">Sem tarefas neste grupo.</p>
          ) : (
            <>
              <ul className="criteria">
                {work.data.items.map((t) => (
                  <li key={t.id} className="criteria__item">
                    <span>
                      <Link to={`/tarefas/${t.id}`}>{t.title}</Link>
                      {t.parentTaskId ? <span className="muted"> · subtarefa</span> : null}
                      <span className="muted"> · {t.projectName}</span>
                    </span>
                    <span className="field__hint">
                      <TaskBadges state={t.state} priority={t.priority} isBlocked={t.isBlocked} isOverdue={t.isOverdue} /> {t.assignee?.name ?? 'sem responsável'}
                      {t.dueDate ? ` · prazo ${formatDate(t.dueDate)}` : ''}
                    </span>
                    {t.isBlocked ? <span className="field__hint">Motivo do bloqueio: {t.blockReason}</span> : null}
                  </li>
                ))}
              </ul>
              <Pagination page={work.data.page} pageSize={work.data.pageSize} total={work.data.total} onPage={setPage} />
            </>
          )}
        </>
      )}
    </section>
  );
}
