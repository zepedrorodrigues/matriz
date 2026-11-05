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
    <section className="page">
      <h1>Alertas</h1>
      {alerts.isPending ? (
        <Notice>A carregar os alertas…</Notice>
      ) : alerts.isError ? (
        <div className="panel">
          <Notice tone="error">Não foi possível carregar os alertas. Verifique a ligação e tente de novo.</Notice>
          <div className="actions">
            <button type="button" onClick={() => void alerts.refetch()} disabled={alerts.isFetching}>
              {alerts.isFetching ? 'A tentar…' : 'Tentar de novo'}
            </button>
          </div>
        </div>
      ) : alerts.data.total === 0 ? (
        <p className="muted">Não tem alertas.</p>
      ) : (
        <>
          <p className="muted">
            {alerts.data.unreadCount === 0
              ? 'Todos os alertas estão lidos.'
              : alerts.data.unreadCount === 1
                ? '1 alerta por ler.'
                : `${alerts.data.unreadCount} alertas por ler.`}
          </p>
          {read.isError ? <Notice tone="error">Não foi possível marcar o alerta como lido. Tente de novo.</Notice> : null}
          <ul className="card-list">
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
    <li className={unread ? 'card card--unread' : 'card'}>
      <p className="card__title">
        {title}
        {unread ? (
          <>
            {' '}
            <span className="badge badge--warning">Por ler</span>
          </>
        ) : null}
      </p>
      {alert.task ? (
        <p className="card__text">
          <Link to={`/tarefas/${alert.task.id}`}>{alert.task.title}</Link>
        </p>
      ) : alert.sprintId ? (
        <p className="card__text">
          <Link to={`/sprints/${alert.sprintId}`}>Ver a sprint{alert.team ? ` da equipa ${alert.team.name}` : ''}</Link>
        </p>
      ) : null}
      <p className="card__text">{detail}</p>
      <p className="card__text muted">{dateTime.format(new Date(alert.createdAt))}</p>
      {unread ? (
        <div className="actions">
          <button type="button" className="button--secondary" onClick={onRead} disabled={busy}>
            {busy ? 'A marcar…' : 'Marcar como lido'}
          </button>
        </div>
      ) : null}
    </li>
  );
}
