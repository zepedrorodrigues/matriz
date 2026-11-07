import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getTeamWork, type WorkGroup } from '@/api/client';
import { Pager } from '@/components/pager';
import { Flag, StateBadge } from '@/components/task-badges';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/domain/sprints';
import { cn } from '@/lib/utils';

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

  if (work.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (work.isError) return <p className="m-0 p-4 text-sm text-destructive">Não foi possível carregar o trabalho da equipa.</p>;
  const w = work.data;

  return (
    <div className="flex flex-col">
      <div role="group" aria-label="Filtrar por grupo" className="flex flex-wrap gap-2 border-b px-4 py-3">
        {GROUPS.map((g) => {
          const count = g.key ? w.counts[g.key] : w.counts.planned + w.counts.in_progress + w.counts.done;
          const on = group === g.key;
          const alarm = (g.key === 'blocked' || g.key === 'overdue') && count > 0;
          return (
            <button
              key={g.label}
              type="button"
              data-slot="filter-pill"
              aria-pressed={on}
              onClick={() => {
                setGroup(g.key);
                setPage(1);
              }}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted',
              )}
            >
              {g.label}
              <span className={cn('rounded-full px-1.5 text-xs', on ? 'bg-primary-foreground/20' : alarm ? 'bg-danger-soft text-destructive' : 'bg-muted')}>{count}</span>
            </button>
          );
        })}
      </div>
      {w.total === 0 ? (
        <p className="m-0 px-4 py-6 text-sm text-muted-foreground">Sem tarefas neste grupo.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Tarefa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {w.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-96 pl-4 whitespace-normal">
                    <Link to={`/tarefas/${t.id}`} className="font-medium text-foreground hover:underline">
                      {t.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.projectName}
                      {t.parentTaskId ? ' · Subtarefa' : ''}
                    </div>
                    {t.isBlocked ? <div className="text-xs text-destructive">Bloqueada: {t.blockReason}</div> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StateBadge state={t.state} />
                      {t.isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
                      {t.priority === 'high' ? <Flag tone="warning">Prioridade alta</Flag> : null}
                    </div>
                  </TableCell>
                  <TableCell>{t.assignee?.name ?? <span className="text-muted-foreground">Sem responsável</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.dueDate ? formatDate(t.dueDate) : '—'}
                    {t.isOverdue ? (
                      <>
                        {' '}
                        <Flag tone="warning">Ultrapassado</Flag>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager page={w.page} pageSize={w.pageSize} total={w.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
