import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError, deleteProject, getProject, updateProject } from '../../api/client';
import { canManageProject, useCurrentUser } from '../../auth/current-user';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DeletedHistory, HistoryTimeline } from '../../components/history-timeline';
import { Notice } from '../../components/Notice';
import { PageFeedbackProvider, usePageFeedback } from '../../components/PageFeedback';
import { ProjectForm } from './ProjectForm';
import { ProjectTasks } from './ProjectTasks';
import { ProjectTeams } from './ProjectTeams';

const dateFormat = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' });

/**
 * Ecrã Detalhe do projeto (Ficha PL 03, Ex. 4 e Ex. 7): dados, gestores e equipas; edição e
 * eliminação com confirmação, só para o administrador e os gestores do projeto (§3.1); tarefas do
 * projeto com filtros e criação (Ex. 5), e a hierarquia de objetivos e épicos (US02). Cada operação de
 * um painel apaga as mensagens das anteriores (PageFeedback; Ex. 8, caso 09).
 */
export function ProjectDetailPage() {
  return (
    <PageFeedbackProvider>
      <ProjectDetail />
    </PageFeedbackProvider>
  );
}

function ProjectDetail() {
  const { projectId = '' } = useParams();
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | undefined>((location.state as { notice?: string } | null)?.notice);
  const announce = usePageFeedback('project', () => setNotice(undefined));

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), retry: false });

  const update = useMutation({
    mutationFn: (input: { name: string; objective?: string }) =>
      updateProject(projectId, { name: input.name, objective: input.objective ?? '' }),
    onMutate: () => {
      setNotice(undefined);
      announce();
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(['project', projectId], updated);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditing(false);
      setNotice('Alterações guardadas.');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      navigate('/projetos', { replace: true, state: { notice: 'Projeto eliminado.' } });
    },
  });

  if (project.isPending) return <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6"><Notice>A carregar o projeto…</Notice></section>;

  if (project.isError) {
    const status = project.error instanceof ApiError ? project.error.status : 0;
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Notice tone="error">
          {status === 404
            ? 'Este projeto não existe ou foi eliminado.'
            : status === 403
              ? 'Não tem acesso a este projeto.'
              : 'Não foi possível carregar o projeto. Tente novamente mais tarde.'}
        </Notice>
        {status === 404 && me.data?.isAdmin && projectId ? <DeletedHistory element="projects" elementId={projectId} label="este projeto foi eliminado" /> : null}
        <Link to="/projetos">Voltar aos projetos</Link>
      </section>
    );
  }

  const p = project.data;
  const mayManage = me.data ? canManageProject(me.data, p.id) : false;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <p>
        <Link to="/projetos">← Projetos</Link>
      </p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h1 className="m-0 text-[22px] font-bold">Editar projeto</h1>
          <ProjectForm
            initial={{ name: p.name, objective: p.objective ?? '' }}
            submitLabel="Guardar alterações"
            busyLabel="A guardar…"
            busy={update.isPending}
            error={update.error}
            onSubmit={(input) => update.mutate(input)}
            onCancel={() => {
              update.reset();
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 text-[22px] font-bold">{p.name}</h1>
            {mayManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline"
                  type="button"
                  onClick={() => {
                    setNotice(undefined);
                    setEditing(true);
                  }}
                >
                  Editar
                </Button>
                <Button variant="destructive" type="button" onClick={() => setConfirming(true)}>
                  Eliminar
                </Button>
              </div>
            ) : null}
          </div>
          <dl className="m-0 grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border bg-card p-4 text-sm [&_dd]:m-0 [&_dd]:font-medium [&_dt]:text-muted-foreground">
            <dt>Objetivo</dt>
            <dd>{p.objective ?? <span className="m-0 text-sm text-muted-foreground">Sem objetivo definido.</span>}</dd>
            <dt>Gestores</dt>
            <dd>{p.managers.map((m) => m.name).join(', ') || '—'}</dd>
            <dt>Criado em</dt>
            <dd>{dateFormat.format(new Date(p.createdAt))}</dd>
          </dl>
        </>
      )}

      {!editing ? <ProjectTeams project={p} mayManage={mayManage} /> : null}

      {!editing && me.data ? <ProjectTasks project={p} me={me.data} /> : null}

      {!editing ? <HistoryTimeline element="projects" elementId={p.id} title="Histórico do projeto" /> : null}

      {confirming ? (
        <ConfirmDialog
          title="Eliminar projeto"
          confirmLabel="Eliminar projeto"
          busy={remove.isPending}
          error={remove.error ? (remove.error instanceof ApiError ? remove.error.message : 'Não foi possível eliminar.') : undefined}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            remove.reset();
            setConfirming(false);
          }}
        >
          <p>
            O projeto «{p.name}» e toda a sua hierarquia deixam de aparecer nas listagens, pesquisas e contagens. O
            histórico mantém-se.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
