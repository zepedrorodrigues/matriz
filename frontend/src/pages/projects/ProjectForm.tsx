import { useState, type FormEvent } from 'react';
import { ApiError, type ProjectInput } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';

/** Mesmas regras da API (RN42, CA01.17), repetidas na interface (architecture.md §7). */
export function validateProject(input: { name: string; objective: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim().length;
  if (name < 3 || name > 100) errors.name = 'O nome tem de ter entre 3 e 100 caracteres, sem contar os espaços no início e no fim.';
  if (input.objective.trim().length > 1000) errors.objective = 'O objetivo pode ter até 1000 caracteres.';
  return errors;
}

interface ProjectFormProps {
  initial?: { name: string; objective: string };
  submitLabel: string;
  busyLabel: string;
  /** Erro da última submissão; os dados do formulário mantêm-se (Ficha PL 03, Ex. 7). */
  error: unknown;
  busy: boolean;
  onSubmit: (input: ProjectInput) => void;
  onCancel?: () => void;
}

/** Formulário de criação e edição de projetos. Não permite submissões repetidas enquanto há um pedido. */
export function ProjectForm({ initial, submitLabel, busyLabel, error, busy, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const serverErrors = error instanceof ApiError && error.status === 400 ? error.fieldErrors() : {};
  const errors = { ...serverErrors, ...clientErrors };
  const generalError =
    error && !(error instanceof ApiError && error.status === 400 && Object.keys(serverErrors).some((k) => k === 'name' || k === 'objective'))
      ? error instanceof ApiError
        ? error.message
        : 'Não foi possível guardar. Tente novamente.'
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = validateProject({ name, objective });
    setClientErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({ name: name.trim(), objective: objective.trim() });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {generalError ? <Notice tone="error">{generalError}</Notice> : null}
      <FormField label="Nome" value={name} onChange={setName} error={errors.name} maxLength={100} hint="Entre 3 e 100 caracteres" required autoFocus />
      <FormField label="Objetivo" value={objective} onChange={setObjective} error={errors.objective} maxLength={1000} multiline />
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
