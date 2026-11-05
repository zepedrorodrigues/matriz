import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, transferTask, type CurrentUser, type Project, type Task, type TaskTransfer } from '../../api/client';
import { canTransferTask } from '../../auth/current-user';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { transferConsequences, transferTargets } from '../../domain/tasks';

interface TransferPanelProps {
  task: Task;
  project: Project | undefined;
  me: CurrentUser | undefined;
  onOperationStart: () => void;
  resetKey: number;
  /** A página recarrega a tarefa, as subtarefas e as listagens e mostra a mensagem (TaskDetailPage). */
  onTransferred: (result: TaskTransfer, message: string) => Promise<void>;
}

/**
 * Transferir para outra equipa (US09; RN14, RN15, RN20, RN22; CA09.3–CA09.5, CA09.7, CA09.8): só o gestor do
 * projeto e o administrador, em tarefas não concluídas; as subtarefas acompanham a principal. Antes de
 * confirmar, mostra as consequências (saída da sprint, responsável). A API decide sempre.
 */
export function TransferPanel({ task, project, me, onOperationStart, resetKey, onTransferred }: TransferPanelProps) {
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const targets = project ? transferTargets(project.teams, task.teamId) : [];
  const target = targets.find((t) => t.id === targetId);

  const transfer = useMutation({
    mutationFn: () => transferTask(task.id, targetId),
    onMutate: () => onOperationStart(),
    onSuccess: async (result) => {
      setConfirming(false);
      setTargetId('');
      const sprint = result.removedFromSprintId ? ' Saiu da sprint em que estava planeada e está no backlog da nova equipa.' : '';
      await onTransferred(result, `Tarefa transferida para «${target?.name ?? ''}».${sprint}`);
    },
    onError: () => setConfirming(false),
  });

  useEffect(() => {
    transfer.reset();
    setError(undefined);
  }, [resetKey]);

  if (!me || !canTransferTask(me, task)) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) {
      setError('Escolha a equipa de destino.');
      return;
    }
    setError(undefined);
    transfer.reset();
    setConfirming(true);
  };

  return (
    <section className="panel" aria-labelledby="transfer-title">
      <h2 id="transfer-title">Transferir para outra equipa</h2>
      {transfer.error ? (
        <Notice tone="error">{transfer.error instanceof ApiError ? transfer.error.message : 'Não foi possível transferir a tarefa.'}</Notice>
      ) : null}
      {targets.length === 0 ? (
        <p className="muted">O projeto não tem outra equipa ativa para onde transferir a tarefa.</p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <div className="form__row">
            <SelectField label="Equipa de destino" value={targetId} onChange={setTargetId} error={error} required>
              <option value="">Escolha a equipa</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="actions">
            <button type="submit" className="button--secondary" disabled={transfer.isPending}>
              Transferir…
            </button>
          </div>
        </form>
      )}
      {confirming && target ? (
        <ConfirmDialog
          title="Transferir a tarefa"
          confirmLabel="Transferir"
          busy={transfer.isPending}
          onConfirm={() => transfer.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <ul>
            {transferConsequences({ subtaskCount: task.subtasks.length, targetName: target.name, hasAssignee: task.assignee !== null }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
