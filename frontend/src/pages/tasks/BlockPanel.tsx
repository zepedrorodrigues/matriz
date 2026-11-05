import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, updateTask, type CurrentUser, type Task } from '../../api/client';
import { canBlockTask } from '../../auth/current-user';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { validateBlockReason } from '../../domain/tasks';

interface BlockPanelProps {
  task: Task;
  me: CurrentUser | undefined;
  onOperationStart: () => void;
  resetKey: number;
  /** A resposta da API substitui a tarefa e atualiza as listagens (TaskDetailPage). */
  onChanged: (updated: Task, message: string) => Promise<void>;
}

/**
 * Bloqueio da tarefa (RN28, CA07.6; SEC06): um indicador, não um estado — o estado mantém-se. Bloquear exige
 * o motivo, que descreve o impedimento ao trabalho; desbloquear apaga-o. Assinalam o administrador, o gestor,
 * o líder e o membro nas tarefas que lhe estão atribuídas (§3.1); a API decide sempre.
 */
export function BlockPanel({ task, me, onOperationStart, resetKey, onChanged }: BlockPanelProps) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const mayBlock = me ? canBlockTask(me, task) : false;

  const change = useMutation({
    mutationFn: (input: { isBlocked: boolean; blockReason?: string }) => updateTask(task.id, input),
    onMutate: () => onOperationStart(),
    onSuccess: async (updated) => {
      setEditing(false);
      await onChanged(updated, updated.isBlocked ? 'Tarefa assinalada como bloqueada.' : 'Bloqueio retirado.');
    },
  });

  useEffect(() => {
    change.reset();
  }, [resetKey]);

  if (!task.isBlocked && !mayBlock) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (change.isPending) return;
    const found = validateBlockReason(reason);
    setError(found);
    if (!found) change.mutate({ isBlocked: true, blockReason: reason.trim() });
  };
  const serverField = change.error instanceof ApiError && change.error.status === 400 ? change.error.fieldErrors().blockReason : undefined;

  return (
    <section className="panel" aria-labelledby="block-title">
      <h2 id="block-title">Bloqueio</h2>
      {change.error && !serverField ? <Notice tone="error">{change.error instanceof ApiError ? change.error.message : 'Não foi possível guardar.'}</Notice> : null}
      {task.isBlocked ? (
        <>
          <Notice tone="warning">
            Bloqueada: {task.blockReason}
          </Notice>
          {mayBlock ? (
            <div className="actions">
              <button type="button" className="button--secondary" disabled={change.isPending} onClick={() => change.mutate({ isBlocked: false })}>
                {change.isPending ? 'A guardar…' : 'Retirar o bloqueio'}
              </button>
            </div>
          ) : null}
        </>
      ) : editing ? (
        <form className="form" onSubmit={submit} noValidate>
          <FormField
            label="Motivo do bloqueio"
            value={reason}
            onChange={setReason}
            error={error ?? serverField}
            maxLength={2000}
            hint="Descreva o impedimento ao trabalho, nunca motivos pessoais"
            multiline
            required
            autoFocus
          />
          <div className="actions">
            <button type="button" className="button--secondary" onClick={() => setEditing(false)} disabled={change.isPending}>
              Cancelar
            </button>
            <button type="submit" disabled={change.isPending}>
              {change.isPending ? 'A guardar…' : 'Assinalar bloqueio'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="muted">Sem bloqueio. O bloqueio não muda o estado da tarefa.</p>
          <div className="actions">
            <button
              type="button"
              className="button--secondary"
              onClick={() => {
                change.reset();
                setError(undefined);
                setReason('');
                setEditing(true);
              }}
            >
              Assinalar bloqueio
            </button>
          </div>
        </>
      )}
    </section>
  );
}
