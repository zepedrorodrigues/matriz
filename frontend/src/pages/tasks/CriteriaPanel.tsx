import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, createCriterion, updateCriterion, type CurrentUser, type Task } from '../../api/client';
import { canDefineCriteria, canRecordCriteria } from '../../auth/current-user';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { FINISHED_STATES, validateCriterionText } from '../../domain/tasks';
import { Button } from '@/components/ui/button';

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
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="criteria-title">
      <h2 id="criteria-title" className="m-0 text-sm font-semibold">Critérios de aceitação</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {generalError ? <Notice tone="error">{errorText(generalError)}</Notice> : null}

      {task.acceptanceCriteria.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Sem critérios de aceitação. São precisos para passar a «Pronto a desenvolver».</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {task.acceptanceCriteria.map((c) => {
            const lockedMet = finished && c.isMet;
            return (
              <li key={c.id} className="flex flex-col gap-1.5 border-b py-2.5 last:border-b-0">
                {editingId === c.id ? (
                  <form className="flex flex-col gap-3" onSubmit={(e) => submitEdit(e, c.id, c.description)} noValidate>
                    <FormField
                      label="Descrição do critério"
                      value={editText}
                      onChange={setEditText}
                      error={editError ?? fieldError(edit.error)}
                      required
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" type="button" onClick={() => setEditingId(null)} disabled={edit.isPending}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={edit.isPending}>
                        {edit.isPending ? 'A guardar…' : 'Guardar critério'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {mayRecord ? (
                      <label className="flex items-start gap-2 text-sm">
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
                        <span className="inline-flex w-fit items-center rounded bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{c.isMet ? 'Cumprido' : 'Por cumprir'}</span> {c.description}
                      </span>
                    )}
                    {c.isMet || mayRecord ? (
                      <span className="text-xs text-muted-foreground">
                        {c.isMet && c.metBy && c.metAt
                          ? `Cumprido · registado por ${c.metBy.name}, ${dateTime.format(new Date(c.metAt))}`
                          : 'Por cumprir'}
                        {lockedMet && mayRecord ? ' · para desmarcar, recue primeiro a tarefa de estado' : ''}
                      </span>
                    ) : null}
                    {mayDefine ? (
                      <Button variant="link" className="h-auto self-start p-0"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          edit.reset();
                          setEditError(undefined);
                          setEditText(c.description);
                          setEditingId(c.id);
                        }}
                      >
                        Editar texto
                      </Button>
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
          <p className="m-0 text-sm text-muted-foreground">Para acrescentar critérios a uma tarefa «Terminada» ou «Entregue», recue-a primeiro de estado.</p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submitNew} noValidate>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? 'A acrescentar…' : 'Acrescentar critério'}
              </Button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}
