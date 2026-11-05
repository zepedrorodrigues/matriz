import { useQuery } from '@tanstack/react-query';
import { getSprintProgress, type WorkTotals } from '../../api/client';
import { Notice } from '../../components/Notice';
import { hoursText } from '../../domain/capacity';

const LEFT = { sprint_ended: 'saiu no fim', removed: 'retirada', transferred: 'transferida' } as const;
const hours = (h: number | null) => (h === null ? '—' : hoursText(h));
const points = (p: number | null) => (p === null ? '—' : `${p} SP`);

/**
 * Planeado e concluído da sprint (US07; CA07.2, RF27, RN10, RN37): horas e story points em separado, com a
 * estimativa do início e a atual; as retiradas depois do início contam no planeado e as acrescentadas
 * aparecem assinaladas.
 */
export function ProgressPanel({ sprintId }: { sprintId: string }) {
  const progress = useQuery({ queryKey: ['sprint-progress', sprintId], queryFn: () => getSprintProgress(sprintId) });
  if (progress.isPending) return <Notice>A carregar a comparação…</Notice>;
  if (progress.isError) return <Notice tone="error">Não foi possível carregar a comparação entre o planeado e o concluído.</Notice>;
  const p = progress.data;
  const row = (label: string, w: WorkTotals) => (
    <li className="criteria__item">
      <strong>
        {label} ({w.tasks === 1 ? '1 tarefa' : `${w.tasks} tarefas`})
      </strong>
      <span className="field__hint">
        Horas: no início {hours(w.startHours)} · atual {hoursText(w.currentHours)} — Story points: no início {points(w.startStoryPoints)} · atual{' '}
        {w.currentStoryPoints} SP
      </span>
    </li>
  );

  return (
    <section className="panel" aria-labelledby="progress-title">
      <h2 id="progress-title">Planeado e concluído</h2>
      {p.status === 'planned' ? <p className="field__hint">A sprint ainda não começou: as estimativas do início ficam registadas quando for iniciada.</p> : null}
      <ul className="criteria">
        {row('Planeado', p.planned)}
        {row('Concluído', p.done)}
      </ul>
      {p.tasks.some((t) => t.addedAfterStart || t.leftReason) ? (
        <p className="field__hint">
          {p.tasks
            .filter((t) => t.addedAfterStart || t.leftReason)
            .map((t) => `«${t.title}» ${[t.addedAfterStart ? 'acrescentada depois do início' : null, t.leftReason ? LEFT[t.leftReason] : null].filter(Boolean).join(', ')}`)
            .join(' · ')}
        </p>
      ) : null}
    </section>
  );
}
