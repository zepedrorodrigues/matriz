import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getSprintCapacity, resetAvailability, setAvailability, type SprintCapacity } from '../../api/client';
import { Notice } from '../../components/Notice';
import { usePageFeedback } from '../../components/PageFeedback';
import { AVAILABILITY_MESSAGE, hoursText, parseAvailability, remainingText } from '../../domain/capacity';

const ROLE = { leader: 'Líder', member: 'Membro' } as const;

/**
 * Capacidade da sprint (wireframe; US05: CA05.1–CA05.7, CA05.9–CA05.11; RN06, RN19): capacidade, horas
 * planeadas e restantes da equipa; story points à parte, nunca convertidos; aviso de sobrecarga sem
 * bloqueio; capacidade por pessoa conforme SEC07 (o líder vê todos, um membro só a sua linha, o gestor e o
 * administrador só os totais) e «Ajustar horas» para o líder, que só pede as horas (SEC06).
 */
export function CapacityPanel({ sprintId, mayAdjust }: { sprintId: string; mayAdjust: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [hours, setHours] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const announce = usePageFeedback('capacity', () => setSuccess(undefined));
  const capacity = useQuery({ queryKey: ['capacity', sprintId], queryFn: () => getSprintCapacity(sprintId) });

  const done = (c: SprintCapacity, message: string) => {
    queryClient.setQueryData(['capacity', sprintId], c);
    setEditing(null);
    setSuccess(message);
  };
  const adjust = useMutation({
    mutationFn: (input: { userId: string; hours: number }) => setAvailability(sprintId, input.userId, input.hours),
    onMutate: () => {
      setSuccess(undefined);
      announce();
    },
    onSuccess: (c, input) => done(c, `Horas de ${c.members.find((m) => m.userId === input.userId)?.name ?? 'membro'} ajustadas.`),
  });
  const reset = useMutation({
    mutationFn: (userId: string) => resetAvailability(sprintId, userId),
    onMutate: () => {
      setSuccess(undefined);
      announce();
    },
    onSuccess: (c) => done(c, 'Horas repostas segundo o cálculo da sprint.'),
  });

  if (capacity.isPending) return <Notice>A carregar a capacidade…</Notice>;
  if (capacity.isError) return <Notice tone="error">Não foi possível carregar a capacidade.</Notice>;
  const c = capacity.data;
  const busy = adjust.isPending || reset.isPending;
  const error = adjust.error ?? reset.error;

  const submit = (e: FormEvent, userId: string) => {
    e.preventDefault();
    if (busy) return;
    const value = parseAvailability(hours);
    setFieldError(value === undefined ? AVAILABILITY_MESSAGE : undefined);
    if (value !== undefined) adjust.mutate({ userId, hours: value });
  };

  return (
    <section className="panel" aria-labelledby="capacity-title">
      <h2 id="capacity-title">Capacidade</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="error">{error instanceof ApiError ? error.message : 'Não foi possível guardar.'}</Notice> : null}
      <dl className="state-counts">
        <div className="state-counts__item">
          <dt>Capacidade</dt>
          <dd>{hoursText(c.capacityHours)}</dd>
        </div>
        <div className="state-counts__item">
          <dt>Planeado</dt>
          <dd>{hoursText(c.plannedHours)}</dd>
        </div>
        <div className="state-counts__item">
          <dt>Restante</dt>
          <dd>{hoursText(c.remainingHours)}</dd>
        </div>
        <div className="state-counts__item">
          <dt>Story points</dt>
          <dd>{c.plannedStoryPoints} SP</dd>
        </div>
      </dl>
      {c.tasksWithoutStoryPoints > 0 ? (
        <p className="field__hint">
          {c.tasksWithoutStoryPoints === 1 ? '1 tarefa sem story points, que conta' : `${c.tasksWithoutStoryPoints} tarefas sem story points, que contam`} como 0.
          As horas e os story points nunca se convertem.
        </p>
      ) : null}
      {c.overloaded ? (
        <Notice tone="warning">
          Sobrecarga da equipa: o planeado {remainingText(c.remainingHours)} a capacidade. O planeamento continua possível.
        </Notice>
      ) : null}

      {c.members.length === 0 ? (
        <p className="muted">Os dados individuais só são visíveis ao líder da equipa e, a cada membro, os seus (SEC07).</p>
      ) : (
        <ul className="criteria" aria-label="Capacidade por pessoa">
          {c.members.map((m) => (
            <li key={m.userId} className="criteria__item">
              <span>
                <strong>{m.name}</strong> · {ROLE[m.role]} · {m.allocationPct} %
                {m.overloaded ? <> <span className="badge badge--warning">Sobrecarga</span></> : null}
              </span>
              <span className="field__hint">
                Capacidade {hoursText(m.capacityHours)}
                {m.availabilityAdjusted ? ' (ajustada)' : ''} · planeado {hoursText(m.plannedHours)} · {remainingText(m.remainingHours)}
              </span>
              {mayAdjust && editing === m.userId ? (
                <form className="form form--inline" onSubmit={(e) => submit(e, m.userId)} noValidate>
                  <div className="field">
                    <label htmlFor={`avail-${m.userId}`}>Horas disponíveis nesta sprint</label>
                    <input
                      id={`avail-${m.userId}`}
                      type="text"
                      inputMode="decimal"
                      value={hours}
                      autoFocus
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={`avail-hint-${m.userId}`}
                      onChange={(e) => setHours(e.target.value)}
                    />
                    <span id={`avail-hint-${m.userId}`} className={fieldError ? 'field__error' : 'field__hint'}>
                      {fieldError ?? 'Só as horas; o motivo não é pedido nem registado.'}
                    </span>
                  </div>
                  <div className="actions">
                    <button type="button" className="button--secondary" onClick={() => setEditing(null)} disabled={busy}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={busy}>
                      {adjust.isPending ? 'A guardar…' : 'Guardar horas'}
                    </button>
                  </div>
                </form>
              ) : mayAdjust ? (
                <span className="actions">
                  <button
                    type="button"
                    className="button--link"
                    disabled={busy}
                    onClick={() => {
                      adjust.reset();
                      setFieldError(undefined);
                      setHours(String(m.capacityHours).replace('.', ','));
                      setEditing(m.userId);
                    }}
                  >
                    Ajustar horas
                  </button>
                  {m.availabilityAdjusted ? (
                    <button type="button" className="button--link" disabled={busy} onClick={() => reset.mutate(m.userId)}>
                      Repor o cálculo
                    </button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
