import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError, listHistory, type HistoryElement } from '../api/client';
import { Notice } from './Notice';
import { Pager } from '@/components/pager';
import { Button } from '@/components/ui/button';
import { describeEvent, omittedNote } from '../domain/history';

const PAGE_SIZE = 20;
const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });

const errorText = (error: unknown) =>
  error instanceof ApiError && error.status === 403
    ? 'Não tem acesso a este histórico.'
    : error instanceof ApiError && error.status === 404
      ? 'Este elemento não existe.'
      : 'Não foi possível carregar o histórico.';

/**
 * D50, decisão 4a: o administrador que abre o endereço de um projeto ou de uma tarefa eliminados vê o aviso
 * «Eliminado» e só o histórico. Aparece só se a API o devolver (200): um identificador que nunca existiu
 * continua a mostrar apenas a mensagem do ecrã (404 também no histórico).
 */
export function DeletedHistory({ element, elementId, label }: { element: 'projects' | 'tasks'; elementId: string; label: string }) {
  const probe = useQuery({
    queryKey: ['history', element, elementId, 1],
    queryFn: () => listHistory(element, elementId, 1, PAGE_SIZE),
  });
  if (!probe.isSuccess) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      <Notice tone="warning">Eliminado: {label}. Como administrador, consulta só o seu histórico (RN38).</Notice>
      <HistoryTimeline element={element} elementId={elementId} />
    </div>
  );
}

/**
 * Histórico de um elemento (I13, RN32, D50): eventos por ordem cronológica, com o autor e a data/hora, paginados
 * (D46); o texto de cada evento vem de `describeEvent`. Estados de carregamento, vazio e erro (Ex. 7). Os valores
 * que a API retirou para quem consulta (SEC07, CAT06) ficam assinalados.
 */
export function HistoryTimeline({ element, elementId, title = 'Histórico' }: { element: HistoryElement; elementId: string; title?: string }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['history', element, elementId, page],
    queryFn: () => listHistory(element, elementId, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const data = history.data;
  const headingId = `history-${element}-${elementId}`;
  const retryable = !(history.error instanceof ApiError && history.error.status < 500);

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby={headingId}>
      <h2 id={headingId} className="m-0 text-sm font-semibold">
        {title}
        {data ? ` (${data.total})` : ''}
      </h2>
      {history.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <Notice tone="error">{errorText(history.error)}</Notice>
          {retryable ? (
            <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
              Tentar de novo
            </Button>
          ) : null}
        </div>
      ) : !data ? (
        <Notice>A carregar o histórico…</Notice>
      ) : data.total === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Ainda não há alterações registadas.</p>
      ) : (
        <>
          <ol className="m-0 flex list-none flex-col p-0" aria-label={`${title} por ordem cronológica`}>
            {data.items.map((e) => {
              const note = omittedNote(e);
              return (
                <li key={e.id} className="flex flex-col gap-1 border-b py-2.5 last:border-b-0">
                  <span className="text-xs text-muted-foreground">
                    <strong>{e.author.name || 'Utilizador desconhecido'}</strong> ·{' '}
                    <time dateTime={e.occurredAt}>{dateTime.format(new Date(e.occurredAt))}</time>
                  </span>
                  <span className="text-sm">{describeEvent(e)}</span>
                  {note ? <span className="text-xs italic text-muted-foreground">{note}</span> : null}
                </li>
              );
            })}
          </ol>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}
