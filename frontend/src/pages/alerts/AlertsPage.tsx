import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listAlerts, markAlertRead, type Alert } from '../../api/client';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { describeAlert } from '../../domain/alerts';

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
const PAGE_SIZE = 20;

/**
 * Alertas (wireframe §1; US07; CA05.8, CA07.5, CA07.7, CA07.8, CA08.2; RN18, RN30; SEC07): só os do
 * utilizador, mais recentes primeiro, com ligação à tarefa ou à sprint; marcar como lido.
 */
export function AlertsPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ['alerts', page], queryFn: () => listAlerts(page, PAGE_SIZE), placeholderData: keepPreviousData });
  const read = useMutation({
    mutationFn: markAlertRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <h1 className="m-0 text-[22px] font-bold">Alertas</h1>
      {alerts.isPending ? (
        <Notice>A carregar os alertas…</Notice>
      ) : alerts.isError ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Notice tone="error">Não foi possível carregar os alertas. Verifique a ligação e tente de novo.</Notice>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void alerts.refetch()} disabled={alerts.isFetching}>
              {alerts.isFetching ? 'A tentar…' : 'Tentar de novo'}
            </Button>
          </div>
        </div>
      ) : alerts.data.total === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Não tem alertas.</p>
      ) : (
        <>
          <p className="m-0 text-sm text-muted-foreground">
            {alerts.data.unreadCount === 0
              ? 'Todos os alertas estão lidos.'
              : alerts.data.unreadCount === 1
                ? '1 alerta por ler.'
                : `${alerts.data.unreadCount} alertas por ler.`}
          </p>
          {read.isError ? <Notice tone="error">Não foi possível marcar o alerta como lido. Tente de novo.</Notice> : null}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {alerts.data.items.map((a) => (
              <AlertItem key={a.id} alert={a} onRead={() => read.mutate(a.id)} busy={read.isPending && read.variables === a.id} />
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={alerts.data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function AlertItem({ alert, onRead, busy }: { alert: Alert; onRead: () => void; busy: boolean }) {
  const { title, detail } = describeAlert(alert);
  const unread = alert.readAt === null;
  return (
    <li className={cn('flex flex-col gap-1.5 rounded-xl border bg-card p-4', unread && 'border-primary/40 shadow-[inset_3px_0_0_var(--primary)]')}>
      <p className="font-semibold text-foreground hover:underline">
        {title}
        {unread ? (
          <>
            {' '}
            <span className="inline-flex w-fit items-center rounded bg-warning-soft px-1.5 text-xs font-semibold text-warning">Por ler</span>
          </>
        ) : null}
      </p>
      {alert.task ? (
        <p className="m-0 text-sm text-foreground/80">
          <Link to={`/tarefas/${alert.task.id}`}>{alert.task.title}</Link>
        </p>
      ) : alert.sprintId ? (
        <p className="m-0 text-sm text-foreground/80">
          <Link to={`/sprints/${alert.sprintId}`}>Ver a sprint{alert.team ? ` da equipa ${alert.team.name}` : ''}</Link>
        </p>
      ) : null}
      <p className="m-0 text-sm text-foreground/80">{detail}</p>
      <p className="m-0 text-sm text-muted-foreground">{dateTime.format(new Date(alert.createdAt))}</p>
      {unread ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" onClick={onRead} disabled={busy}>
            {busy ? 'A marcar…' : 'Marcar como lido'}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
