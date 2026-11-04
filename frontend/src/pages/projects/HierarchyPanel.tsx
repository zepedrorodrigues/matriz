import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, createEpic, createObjective, type ElementInput, type Objective } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';

/** Formulário de um objetivo ou de um épico: título obrigatório, sem ser só espaços (ElementInput). */
function ElementForm({
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  submitLabel: string;
  busy: boolean;
  error: unknown;
  onSubmit: (input: ElementInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientError, setClientError] = useState<string>();
  const serverErrors = error instanceof ApiError ? error.fieldErrors() : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = title.trim() === '' ? 'O título é obrigatório e não pode ter só espaços.' : undefined;
    setClientError(invalid);
    if (invalid) return;
    onSubmit({ title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
  };

  return (
    <form className="form form--inline" onSubmit={submit} noValidate>
      {error && !serverErrors.title ? (
        <Notice tone="error">{error instanceof ApiError ? error.message : 'Não foi possível guardar. Tente novamente.'}</Notice>
      ) : null}
      <FormField label="Título" value={title} onChange={setTitle} error={clientError ?? serverErrors.title} required autoFocus />
      <FormField label="Descrição" value={description} onChange={setDescription} />
      <div className="actions">
        <button type="button" className="button--secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'A criar…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Objetivos e épicos do projeto (US02, CA02.1, CA02.2, CA02.6): a hierarquia a que as tarefas
 * pertencem. A criação aparece a quem a matriz o permite (§3.1); a API decide sempre.
 */
export function HierarchyPanel({ projectId, objectives, mayCreate }: { projectId: string; objectives: Objective[]; mayCreate: boolean }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<'objective' | string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['objectives', projectId] });

  const newObjective = useMutation({
    mutationFn: (input: ElementInput) => createObjective(projectId, input),
    onSuccess: async () => {
      await refresh();
      setAdding(null);
    },
  });
  const newEpic = useMutation({
    mutationFn: ({ objectiveId, input }: { objectiveId: string; input: ElementInput }) => createEpic(objectiveId, input),
    onSuccess: async () => {
      await refresh();
      setAdding(null);
    },
  });

  const open = (target: 'objective' | string) => {
    newObjective.reset();
    newEpic.reset();
    setAdding(target);
  };

  return (
    <section className="panel" aria-labelledby="hierarchy-title">
      <div className="page__header">
        <h2 id="hierarchy-title">Objetivos e épicos</h2>
        {mayCreate && adding !== 'objective' ? (
          <button type="button" className="button--secondary" onClick={() => open('objective')}>
            Novo objetivo
          </button>
        ) : null}
      </div>
      {adding === 'objective' ? (
        <ElementForm
          submitLabel="Criar objetivo"
          busy={newObjective.isPending}
          error={newObjective.error}
          onSubmit={(input) => newObjective.mutate(input)}
          onCancel={() => setAdding(null)}
        />
      ) : null}
      {objectives.length === 0 ? (
        <p className="muted">Este projeto ainda não tem objetivos. As tarefas pertencem a um épico de um objetivo.</p>
      ) : (
        <ul className="tree">
          {objectives.map((o) => (
            <li key={o.id}>
              <strong>{o.title}</strong>
              {o.epics.length > 0 ? (
                <ul>
                  {o.epics.map((e) => (
                    <li key={e.id}>{e.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sem épicos.</p>
              )}
              {mayCreate && adding !== o.id ? (
                <button type="button" className="button--link" onClick={() => open(o.id)}>
                  Novo épico em «{o.title}»
                </button>
              ) : null}
              {adding === o.id ? (
                <ElementForm
                  submitLabel="Criar épico"
                  busy={newEpic.isPending}
                  error={newEpic.error}
                  onSubmit={(input) => newEpic.mutate({ objectiveId: o.id, input })}
                  onCancel={() => setAdding(null)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
