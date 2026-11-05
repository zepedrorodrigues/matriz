import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  addParticipant,
  listEligibleUsers,
  removeParticipant,
  updateTask,
  type CurrentUser,
  type Task,
  type UserSummary,
} from '../../api/client';
import { canAssignTask, canChooseOtherTeams } from '../../auth/current-user';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { needsJustification } from '../../domain/tasks';

const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');
const JUSTIFICATION_MESSAGE = 'Indique a justificação para escolher alguém de outra equipa.';

interface AssignmentPanelProps {
  task: Task;
  me: CurrentUser | undefined;
  /** Ao começar uma operação daqui, o ecrã apaga o resultado das suas (Ex. 8, caso 09). */
  onOperationStart: () => void;
  /** Muda quando começa uma operação noutra parte do ecrã: apaga o resultado deste painel. */
  resetKey: number;
}

/**
 * Responsável pela execução e participantes da tarefa (Ficha PL 03, Ex. 6; CA03.3, CA03.13–CA03.16,
 * CA09.1, CA09.6; RN03, RN15, RN40). Oferece só os utilizadores elegíveis da API: os membros da equipa
 * responsável e, para o gestor e o administrador, os de outras equipas, com justificação. A API decide
 * sempre (existência, elegibilidade, repetições) e a interface mostra o motivo de uma recusa.
 */
export function AssignmentPanel({ task, me, onOperationStart, resetKey }: AssignmentPanelProps) {
  const queryClient = useQueryClient();
  const mayAssign = me ? canAssignTask(me, task) : false;
  const mayCross = me ? canChooseOtherTeams(me, task) : false;

  const [includeOthers, setIncludeOthers] = useState(false);
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '');
  const [assignJustification, setAssignJustification] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [participantJustification, setParticipantJustification] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string>();

  // A atribuição confirmada pela API passa a ser o valor do seletor.
  useEffect(() => setAssigneeId(task.assignee?.id ?? ''), [task.assignee?.id]);

  const teamUsers = useQuery({
    queryKey: ['eligible', task.id, 'team'],
    queryFn: () => listEligibleUsers(task.id, 'team'),
    enabled: mayAssign,
  });
  const allUsers = useQuery({
    queryKey: ['eligible', task.id, 'all'],
    queryFn: () => listEligibleUsers(task.id, 'all'),
    enabled: mayCross && includeOthers,
  });
  const teamIds = (teamUsers.data ?? []).map((u) => u.id);
  const otherUsers = includeOthers ? (allUsers.data ?? []).filter((u) => !teamIds.includes(u.id)) : [];

  const refresh = async (updated?: Task) => {
    if (updated) queryClient.setQueryData(['task', task.id], updated);
    else await queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    await queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
  };

  const assign = useMutation({
    mutationFn: (input: { assigneeId: string | null; justification?: string }) =>
      updateTask(task.id, {
        assigneeId: input.assigneeId,
        ...(input.justification ? { assignmentJustification: input.justification } : {}),
      }),
    onMutate: () => start('assign'),
    onSuccess: async (updated) => {
      setAssignJustification('');
      await refresh(updated);
      setSuccess(updated.assignee ? `Tarefa atribuída a ${updated.assignee.name}.` : 'A tarefa ficou sem responsável.');
    },
  });

  const add = useMutation({
    mutationFn: (input: { userId: string; justification?: string }) => addParticipant(task.id, input),
    onMutate: () => start('add'),
    onSuccess: async (participant) => {
      setParticipantId('');
      setParticipantJustification('');
      await refresh();
      setSuccess(`${participant.user.name} passou a participante.`);
    },
  });

  const remove = useMutation({
    mutationFn: (user: UserSummary) => removeParticipant(task.id, user.id),
    onMutate: () => start('remove'),
    onSuccess: async (_, user) => {
      await refresh();
      setSuccess(`${user.name} deixou de ser participante.`);
    },
  });

  function start(current: 'assign' | 'add' | 'remove') {
    onOperationStart();
    setSuccess(undefined);
    if (current !== 'assign') assign.reset();
    if (current !== 'add') add.reset();
    if (current !== 'remove') remove.reset();
  }

  // Uma operação noutra parte do ecrã apaga os resultados deste painel.
  useEffect(() => {
    setSuccess(undefined);
    assign.reset();
    add.reset();
    remove.reset();
  }, [resetKey]);

  const busy = assign.isPending || add.isPending || remove.isPending;
  const assignNeedsJustification = needsJustification(assigneeId, teamIds);
  const participantNeedsJustification = needsJustification(participantId, teamIds);
  const participantIds = task.participants.map((p) => p.user.id);

  const submitAssign = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors: Record<string, string> = {};
    if (assignNeedsJustification && assignJustification.trim() === '') errors.assignJustification = JUSTIFICATION_MESSAGE;
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || assigneeId === (task.assignee?.id ?? '')) return;
    assign.mutate({
      assigneeId: assigneeId || null,
      justification: assignNeedsJustification ? assignJustification.trim() : undefined,
    });
  };

  const submitParticipant = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors: Record<string, string> = {};
    if (!participantId) errors.participant = 'Escolha o utilizador a associar.';
    if (participantNeedsJustification && participantJustification.trim() === '') errors.participantJustification = JUSTIFICATION_MESSAGE;
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;
    add.mutate({
      userId: participantId,
      justification: participantNeedsJustification ? participantJustification.trim() : undefined,
    });
  };

  const options = (exclude: string[] = []) => (
    <>
      {(teamUsers.data ?? [])
        .filter((u) => !exclude.includes(u.id))
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      {otherUsers.length > 0 ? (
        <optgroup label="Outras equipas (com justificação)">
          {otherUsers
            .filter((u) => !exclude.includes(u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </optgroup>
      ) : null}
    </>
  );

  const error = [assign.error, add.error, remove.error].find(Boolean);
  // O responsável atual pode ser de outra equipa (RN03): mantém-se como opção, mesmo fora dos elegíveis.
  const currentOutside =
    task.assignee && !teamIds.includes(task.assignee.id) && !otherUsers.some((u) => u.id === task.assignee!.id)
      ? task.assignee
      : null;

  return (
    <section className="panel" aria-labelledby="assignment-title">
      <h2 id="assignment-title">Responsável e participantes</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="error">{errorText(error)}</Notice> : null}
      {teamUsers.isError ? <Notice tone="error">Não foi possível carregar os utilizadores elegíveis.</Notice> : null}

      {mayAssign ? (
        <>
          {mayCross ? (
            <label className="criteria__check">
              <input type="checkbox" checked={includeOthers} onChange={(e) => setIncludeOthers(e.target.checked)} disabled={busy} />
              <span>Mostrar também utilizadores de outras equipas (exige justificação)</span>
            </label>
          ) : null}

          <form className="form form--inline" onSubmit={submitAssign} noValidate>
            <SelectField
              label="Responsável pela execução"
              value={assigneeId}
              onChange={(v) => {
                setAssigneeId(v);
                setClientErrors({});
              }}
              hint={mayCross ? undefined : 'Só membros da equipa responsável.'}
            >
              <option value="">Sem responsável</option>
              {currentOutside ? <option value={currentOutside.id}>{currentOutside.name}</option> : null}
              {options()}
            </SelectField>
            {assignNeedsJustification && assigneeId !== task.assignee?.id ? (
              <FormField
                label="Justificação (outra equipa)"
                value={assignJustification}
                onChange={setAssignJustification}
                error={clientErrors.assignJustification}
                required
              />
            ) : null}
            <div className="actions">
              <button type="submit" disabled={busy || assigneeId === (task.assignee?.id ?? '')}>
                {assign.isPending ? 'A atribuir…' : 'Guardar responsável'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p>
          <strong>Responsável pela execução:</strong> {task.assignee?.name ?? <span className="muted">Sem responsável.</span>}
        </p>
      )}

      <h3>Participantes</h3>
      {task.participants.length === 0 ? (
        <p className="muted">Sem participantes.</p>
      ) : (
        <ul className="criteria">
          {task.participants.map((p) => (
            <li key={p.user.id} className="criteria__item">
              <span>{p.user.name}</span>
              <span className="field__hint">
                Associado por {p.addedBy.name}, {dateTime.format(new Date(p.addedAt))}
              </span>
              {mayAssign ? (
                <button type="button" className="button--link" disabled={busy} onClick={() => remove.mutate(p.user)}>
                  {remove.isPending && remove.variables?.id === p.user.id ? 'A remover…' : `Remover ${p.user.name}`}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mayAssign ? (
        <form className="form form--inline" onSubmit={submitParticipant} noValidate>
          <SelectField
            label="Associar participante"
            value={participantId}
            onChange={(v) => {
              setParticipantId(v);
              setClientErrors({});
            }}
            error={clientErrors.participant}
            hint="Os participantes não substituem o responsável nem ganham permissões sobre a tarefa."
          >
            <option value="">Escolha um utilizador</option>
            {options(participantIds)}
          </SelectField>
          {participantNeedsJustification ? (
            <FormField
              label="Justificação (outra equipa)"
              value={participantJustification}
              onChange={setParticipantJustification}
              error={clientErrors.participantJustification}
              required
            />
          ) : null}
          <div className="actions">
            <button type="submit" disabled={busy}>
              {add.isPending ? 'A associar…' : 'Associar participante'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
