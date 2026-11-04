import { useState, type FormEvent } from 'react';
import { ApiError, type Objective } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { PRIORITIES, PRIORITY_LABEL, validateTaskText, type Priority } from '../../domain/tasks';

export interface TaskFormValues {
  title: string;
  description: string;
  priority: Priority;
  epicId?: string;
  teamId?: string;
}

interface TaskFormProps {
  initial?: { title: string; description: string; priority: Priority };
  /** Só na criação de uma tarefa: épicos do projeto, agrupados por objetivo (RN12). */
  objectives?: Objective[];
  /** Só na criação de uma tarefa: equipas para onde o utilizador pode criar (RN21, RN23). */
  teams?: { id: string; name: string }[];
  /** RN39: depois de criada, só o líder, o gestor e o administrador alteram a prioridade. */
  priorityEditable?: boolean;
  submitLabel: string;
  busyLabel: string;
  /** Erro da última submissão; os dados do formulário mantêm-se (Ficha PL 03, Ex. 7). */
  error: unknown;
  busy: boolean;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}

const FIELDS = ['title', 'description', 'priority', 'epicId', 'teamId'];

/**
 * Formulário de tarefas e subtarefas (criação e edição). Valida como a API (CA03.18) e não permite
 * submissões repetidas enquanto há um pedido em curso.
 */
export function TaskForm({
  initial,
  objectives,
  teams,
  priorityEditable = true,
  submitLabel,
  busyLabel,
  error,
  busy,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const withHierarchy = objectives !== undefined && teams !== undefined;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [epicId, setEpicId] = useState(objectives?.flatMap((o) => o.epics)[0]?.id ?? '');
  const [teamId, setTeamId] = useState(teams?.length === 1 ? teams[0].id : '');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const serverErrors = error instanceof ApiError && error.status === 400 ? error.fieldErrors() : {};
  const errors = { ...serverErrors, ...clientErrors };
  const generalError =
    error && !(error instanceof ApiError && error.status === 400 && Object.keys(serverErrors).some((k) => FIELDS.includes(k)))
      ? error instanceof ApiError
        ? error.message
        : 'Não foi possível guardar. Tente novamente.'
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = validateTaskText({ title, description });
    if (withHierarchy && !epicId) found.epicId = 'Escolha o épico a que a tarefa pertence.';
    if (withHierarchy && !teamId) found.teamId = 'Escolha a equipa responsável.';
    setClientErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      ...(withHierarchy ? { epicId, teamId } : {}),
    });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {generalError ? <Notice tone="error">{generalError}</Notice> : null}
      <FormField label="Título" value={title} onChange={setTitle} error={errors.title} maxLength={150} hint="Entre 3 e 150 caracteres" required autoFocus />
      <FormField label="Descrição" value={description} onChange={setDescription} error={errors.description} maxLength={2000} multiline />
      {withHierarchy ? (
        <div className="form__row">
          <SelectField label="Épico" value={epicId} onChange={setEpicId} error={errors.epicId} required>
            <option value="">Escolha um épico</option>
            {objectives.map((o) => (
              <optgroup key={o.id} label={o.title}>
                {o.epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField label="Equipa responsável" value={teamId} onChange={setTeamId} error={errors.teamId} required>
            <option value="">Escolha uma equipa</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
        </div>
      ) : null}
      <SelectField
        label="Prioridade"
        value={priority}
        onChange={(v) => setPriority(v as Priority)}
        error={errors.priority}
        disabled={!priorityEditable}
        hint={priorityEditable ? undefined : 'Só o líder da equipa, o gestor do projeto e o administrador alteram a prioridade.'}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </SelectField>
      <div className="actions">
        {onCancel ? (
          <button type="button" className="button--secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
