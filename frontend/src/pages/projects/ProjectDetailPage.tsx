import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError, deleteProject, getProject, updateProject } from '../../api/client';
import { canManageProject, useCurrentUser } from '../../auth/current-user';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { ProjectForm } from './ProjectForm';
import { ProjectTasks } from './ProjectTasks';

const dateFormat = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' });

/**
 * Ecrã Detalhe do projeto (Ficha PL 03, Ex. 4 e Ex. 7): dados, gestores e equipas; edição e
 * eliminação com confirmação, só para o administrador e os gestores do projeto (§3.1); tarefas do
 * projeto com filtros e criação (Ex. 5), e a hierarquia de objetivos e épicos (US02).
 */
export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | undefined>((location.state as { notice?: string } | null)?.notice);

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), retry: false });

  const update = useMutation({
    mutationFn: (input: { name: string; objective?: string }) =>
      updateProject(projectId, { name: input.name, objective: input.objective ?? '' }),
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

  if (project.isPending) return <section className="page"><Notice>A carregar o projeto…</Notice></section>;

  if (project.isError) {
    const status = project.error instanceof ApiError ? project.error.status : 0;
    return (
      <section className="page">
        <Notice tone="error">
          {status === 404
            ? 'Este projeto não existe ou foi eliminado.'
            : status === 403
              ? 'Não tem acesso a este projeto.'
              : 'Não foi possível carregar o projeto. Tente novamente mais tarde.'}
        </Notice>
        <Link to="/projetos">Voltar aos projetos</Link>
      </section>
    );
  }

  const p = project.data;
  const mayManage = me.data ? canManageProject(me.data, p.id) : false;

  return (
    <section className="page">
      <p>
        <Link to="/projetos">← Projetos</Link>
      </p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {editing ? (
        <div className="panel">
          <h1>Editar projeto</h1>
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
          <div className="page__header">
            <h1>{p.name}</h1>
            {mayManage ? (
              <div className="actions">
                <button
                  type="button"
                  className="button--secondary"
                  onClick={() => {
                    setNotice(undefined);
                    setEditing(true);
                  }}
                >
                  Editar
                </button>
                <button type="button" className="button--danger" onClick={() => setConfirming(true)}>
                  Eliminar
                </button>
              </div>
            ) : null}
          </div>
          <dl className="profile">
            <dt>Objetivo</dt>
            <dd>{p.objective ?? <span className="muted">Sem objetivo definido.</span>}</dd>
            <dt>Gestores</dt>
            <dd>{p.managers.map((m) => m.name).join(', ') || '—'}</dd>
            <dt>Equipas</dt>
            <dd>
              {p.teams.length === 0
                ? 'Nenhuma equipa associada.'
                : p.teams.map((t) => (t.active ? t.name : `${t.name} (desativada)`)).join(', ')}
            </dd>
            <dt>Criado em</dt>
            <dd>{dateFormat.format(new Date(p.createdAt))}</dd>
          </dl>
        </>
      )}

      {!editing && me.data ? <ProjectTasks project={p} me={me.data} /> : null}

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
