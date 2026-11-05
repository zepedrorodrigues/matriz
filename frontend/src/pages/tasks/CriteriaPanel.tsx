import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, createCriterion, updateCriterion, type CurrentUser, type Task } from '../../api/client';
import { canDefineCriteria, canRecordCriteria } from '../../auth/current-user';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { FINISHED_STATES, validateCriterionText } from '../../domain/tasks';

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');
const fieldError = (error: unknown) =>
  error instanceof ApiError && error.status === 400 ? error.fieldErrors().description : undefined;

interface CriteriaPanelProps {
  task: Task;
  me: CurrentUser | undefined;
  /** Ao começar uma operação daqui, o ecrã apaga o resultado das suas (Ex. 8, caso 09). */
  onOperationStart: () => void;
  /** Muda quando começa uma operação noutra parte do ecrã: apaga o resultado deste painel. */
  resetKey: number;
}

/**
 * Critérios de aceitação da tarefa (US06; CA06.7–CA06.9; RN13, RN24): acrescentar, alterar o texto e
 * registar o cumprimento. Cada ação aparece a quem a matriz o permite (§3.1); a API decide sempre e a
 * interface mostra o motivo de uma recusa. Os dados escritos mantêm-se quando o pedido falha. O resultado
 * de cada operação aparece no próprio painel, junto de onde se trabalha.
 */
export function CriteriaPanel({ task, me, onOperationStart, resetKey }: CriteriaPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const mayDefine = me ? canDefineCriteria(me, task) : false;
  const mayRecord = me ? canRecordCriteria(me, task) : false;
  const finished = FINISHED_STATES.includes(task.state);

  /** O critério alterado muda a tarefa (cumprimento, transições de RN27 e RN13): recarrega-se. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['task', task.id] });

  const add = useMutation({
    mutationFn: (description: string) => createCriterion(task.id, { description }),
    onMutate: () => start('add'),
    onSuccess: async () => {
      setDraft('');
      await refresh();
      setSuccess('Critério de aceitação acrescentado.');
    },
  });

  const edit = useMutation({
    mutationFn: (input: { id: string; description: string }) => updateCriterion(task.id, input.id, { description: input.description }),
    onMutate: () => start('edit'),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
      setSuccess('Critério de aceitação alterado.');
    },
  });

  const record = useMutation({
    mutationFn: (input: { id: string; isMet: boolean }) => updateCriterion(task.id, input.id, { isMet: input.isMet }),
    onMutate: () => start('record'),
    onSuccess: async (criterion) => {
      await refresh();
      setSuccess(criterion.isMet ? 'Critério marcado como cumprido.' : 'O critério voltou a ficar por cumprir.');
    },
  });

  function start(current: 'add' | 'edit' | 'record') {
    onOperationStart();
    setSuccess(undefined);
    if (current !== 'add') add.reset();
    if (current !== 'edit') edit.reset();
    if (current !== 'record') record.reset();
  }

  // Uma operação noutra parte do ecrã apaga os resultados deste painel.
  useEffect(() => {
    setSuccess(undefined);
    add.reset();
    edit.reset();
    record.reset();
  }, [resetKey]);

  const busy = add.isPending || edit.isPending || record.isPending;

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const error = validateCriterionText(draft);
    setDraftError(error);
    if (!error) add.mutate(draft.trim());
  };

  const submitEdit = (e: FormEvent, id: string, current: string) => {
    e.preventDefault();
    if (busy) return;
    const error = validateCriterionText(editText);
    setEditError(error);
    if (error) return;
    if (editText.trim() === current) {
      setEditingId(null);
      return;
    }
    edit.mutate({ id, description: editText.trim() });
  };

  const generalError = [add, edit, record]
    .map((m) => m.error)
    .find((error) => error && !fieldError(error));

  return (
    <section className="panel" aria-labelledby="criteria-title">
      <h2 id="criteria-title">Critérios de aceitação</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {generalError ? <Notice tone="error">{errorText(generalError)}</Notice> : null}

      {task.acceptanceCriteria.length === 0 ? (
        <p className="muted">Sem critérios de aceitação. São precisos para passar a «Pronto a desenvolver».</p>
      ) : (
        <ul className="criteria">
          {task.acceptanceCriteria.map((c) => {
            const lockedMet = finished && c.isMet;
            return (
              <li key={c.id} className="criteria__item">
                {editingId === c.id ? (
                  <form className="form form--inline" onSubmit={(e) => submitEdit(e, c.id, c.description)} noValidate>
                    <FormField
                      label="Descrição do critério"
                      value={editText}
                      onChange={setEditText}
                      error={editError ?? fieldError(edit.error)}
                      required
                      autoFocus
                    />
                    <div className="actions">
                      <button type="button" className="button--secondary" onClick={() => setEditingId(null)} disabled={edit.isPending}>
                        Cancelar
                      </button>
                      <button type="submit" disabled={edit.isPending}>
                        {edit.isPending ? 'A guardar…' : 'Guardar critério'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {mayRecord ? (
                      <label className="criteria__check">
                        <input
                          type="checkbox"
                          checked={c.isMet}
                          disabled={busy || lockedMet}
                          onChange={(e) => record.mutate({ id: c.id, isMet: e.target.checked })}
                        />
                        <span>{c.description}</span>
                      </label>
                    ) : (
                      <span>
                        <span className="badge">{c.isMet ? 'Cumprido' : 'Por cumprir'}</span> {c.description}
                      </span>
                    )}
                    {c.isMet || mayRecord ? (
                      <span className="field__hint">
                        {c.isMet && c.metBy && c.metAt
                          ? `Cumprido · registado por ${c.metBy.name}, ${dateTime.format(new Date(c.metAt))}`
                          : 'Por cumprir'}
                        {lockedMet && mayRecord ? ' · para desmarcar, recue primeiro a tarefa de estado' : ''}
                      </span>
                    ) : null}
                    {mayDefine ? (
                      <button
                        type="button"
                        className="button--link"
                        disabled={busy}
                        onClick={() => {
                          edit.reset();
                          setEditError(undefined);
                          setEditText(c.description);
                          setEditingId(c.id);
                        }}
                      >
                        Editar texto
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mayDefine ? (
        finished ? (
          <p className="muted">Para acrescentar critérios a uma tarefa «Terminada» ou «Entregue», recue-a primeiro de estado.</p>
        ) : (
          <form className="form form--inline" onSubmit={submitNew} noValidate>
            <FormField
              label="Novo critério"
              value={draft}
              onChange={(value) => {
                setDraft(value);
                setDraftError(undefined);
              }}
              error={draftError ?? fieldError(add.error)}
              hint="Cada critério fica por cumprir até alguém registar o cumprimento."
            />
            <div className="actions">
              <button type="submit" disabled={add.isPending}>
                {add.isPending ? 'A acrescentar…' : 'Acrescentar critério'}
              </button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}
