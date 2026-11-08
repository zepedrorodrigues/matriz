import { Button } from '@/components/ui/button';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, createEpic, createObjective, type ElementInput, type Objective } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { usePageFeedback } from '../../components/PageFeedback';
import { HistoryTimeline } from '../../components/history-timeline';

/** Histórico de um objetivo ou épico (D50 3a), pedido só quando se abre. */
function ElementHistory({ element, elementId, label }: { element: 'objectives' | 'epics'; elementId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Ocultar histórico' : 'Histórico'}
      </Button>
      {open ? (
        <div className="my-2">
          <HistoryTimeline element={element} elementId={elementId} title={`Histórico de «${label}»`} />
        </div>
      ) : null}
    </>
  );
}

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
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      {error && !serverErrors.title ? (
        <Notice tone="error">{error instanceof ApiError ? error.message : 'Não foi possível guardar. Tente novamente.'}</Notice>
      ) : null}
      <FormField label="Título" value={title} onChange={setTitle} error={clientError ?? serverErrors.title} required autoFocus />
      <FormField label="Descrição" value={description} onChange={setDescription} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'A criar…' : submitLabel}
        </Button>
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
  // Este painel não mostra mensagens de sucesso, mas as suas operações apagam as dos outros painéis.
  const announce = usePageFeedback('hierarchy', () => {});

  const newObjective = useMutation({
    mutationFn: (input: ElementInput) => createObjective(projectId, input),
    onMutate: () => announce(),
    onSuccess: async () => {
      await refresh();
      setAdding(null);
    },
  });
  const newEpic = useMutation({
    mutationFn: ({ objectiveId, input }: { objectiveId: string; input: ElementInput }) => createEpic(objectiveId, input),
    onMutate: () => announce(),
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
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="hierarchy-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hierarchy-title" className="m-0 text-base font-semibold">Objetivos e épicos</h2>
        {mayCreate && adding !== 'objective' ? (
          <Button variant="outline" type="button" onClick={() => open('objective')}>
            Novo objetivo
          </Button>
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
        <p className="m-0 text-sm text-muted-foreground">Este projeto ainda não tem objetivos. As tarefas pertencem a um épico de um objetivo.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 [&_ul]:m-0 [&_ul]:mt-1 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:border-l [&_ul]:pl-4">
          {objectives.map((o) => (
            <li key={o.id}>
              <strong>{o.title}</strong> <ElementHistory element="objectives" elementId={o.id} label={o.title} />
              {o.epics.length > 0 ? (
                <ul>
                  {o.epics.map((e) => (
                    <li key={e.id}>
                      {e.title} <ElementHistory element="epics" elementId={e.id} label={e.title} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Sem épicos.</p>
              )}
              {mayCreate && adding !== o.id ? (
                <Button variant="link" className="h-auto self-start p-0" type="button" onClick={() => open(o.id)}>
                  Novo épico em «{o.title}»
                </Button>
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
