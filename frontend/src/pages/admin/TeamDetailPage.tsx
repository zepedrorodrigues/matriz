import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError, deactivateTeam, getTeam, listUsers, renameTeam, type TeamDetail } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { AdminNav } from './AdminNav';
import { MembershipEditor } from './MembershipEditor';

const ROLE = { leader: 'Líder', member: 'Membro' } as const;
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.');

/**
 * Ecrã Administração › Equipa (US01; CA01.7, CA01.9–CA01.12; RN06, RN33, RN34; F18): nome, membros com
 * papel e alocação, pertenças (editor do conjunto completo de cada pessoa) e desativação com
 * confirmação — recusada enquanto houver tarefas por concluir. Os membros cuja soma nas equipas ativas
 * não é 100 % aparecem assinalados para realocar.
 */
export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | undefined>((location.state as { notice?: string } | null)?.notice);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<{ userId: string; userName: string; addTeamId?: string } | null>(null);
  const [newMemberId, setNewMemberId] = useState('');

  const team = useQuery({ queryKey: ['team', teamId], queryFn: () => getTeam(teamId), retry: false });
  const accounts = useQuery({ queryKey: ['users', { all: true }], queryFn: () => listUsers({ pageSize: 100 }) });

  const applied = (updated: TeamDetail, message: string) => {
    queryClient.setQueryData(['team', teamId], updated);
    void queryClient.invalidateQueries({ queryKey: ['teams'] });
    setNotice(message);
  };

  const rename = useMutation({
    mutationFn: (name: string) => renameTeam(teamId, name),
    onMutate: () => setNotice(undefined),
    onSuccess: (updated) => {
      setRenaming(false);
      applied(updated, 'Nome alterado.');
    },
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateTeam(teamId),
    onMutate: () => setNotice(undefined),
    onSuccess: (updated) => {
      setConfirming(false);
      applied(updated, 'Equipa desativada. Deixa de receber tarefas; o histórico mantém-se.');
    },
  });

  if (team.isPending) return <section className="page"><Notice>A carregar a equipa…</Notice></section>;
  if (team.isError) {
    return (
      <section className="page">
        <AdminNav />
        <Notice tone="error">
          {team.error instanceof ApiError && team.error.status === 404 ? 'Esta equipa não existe.' : 'Não foi possível carregar a equipa.'}
        </Notice>
        <Link to="/administracao/equipas">Voltar às equipas</Link>
      </section>
    );
  }

  const t = team.data;
  const memberIds = t.members.map((m) => m.user.id);
  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    if (!rename.isPending) rename.mutate(newName.trim());
  };

  return (
    <section className="page">
      <AdminNav />
      <p className="breadcrumbs">
        <Link to="/administracao/equipas">← Equipas</Link>
      </p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {renaming ? (
        <form className="panel form" onSubmit={submitRename} noValidate>
          <h1>Alterar o nome</h1>
          {rename.error && !(rename.error instanceof ApiError && rename.error.status === 400) ? <Notice tone="error">{errorText(rename.error)}</Notice> : null}
          <FormField
            label="Nome"
            value={newName}
            onChange={setNewName}
            maxLength={100}
            error={rename.error instanceof ApiError && rename.error.status === 400 ? rename.error.fieldErrors().name : undefined}
            required
            autoFocus
          />
          <div className="actions">
            <button type="button" className="button--secondary" onClick={() => setRenaming(false)} disabled={rename.isPending}>
              Cancelar
            </button>
            <button type="submit" disabled={rename.isPending}>
              {rename.isPending ? 'A guardar…' : 'Guardar nome'}
            </button>
          </div>
        </form>
      ) : (
        <div className="page__header">
          <h1>
            {t.name}
            {t.active ? null : <span className="badge"> Desativada</span>}
          </h1>
          <div className="actions">
            <button
              type="button"
              className="button--secondary"
              onClick={() => {
                rename.reset();
                setNewName(t.name);
                setRenaming(true);
              }}
            >
              Alterar o nome
            </button>
            {t.active ? (
              <button
                type="button"
                className="button--danger"
                onClick={() => {
                  deactivate.reset();
                  setConfirming(true);
                }}
              >
                Desativar
              </button>
            ) : null}
          </div>
        </div>
      )}

      <p className="muted">
        {t.active
          ? `${t.openTaskCount === 1 ? '1 tarefa' : `${t.openTaskCount} tarefas`} por concluir.`
          : `Desativada em ${new Date(t.deactivatedAt!).toLocaleString('pt-PT')}: não recebe tarefas; o histórico e as pertenças mantêm-se.`}
      </p>

      <section className="panel" aria-labelledby="members-title">
        <h2 id="members-title">Membros</h2>
        {t.members.length === 0 ? (
          <p className="muted">Sem membros.</p>
        ) : (
          <ul className="criteria">
            {t.members.map((m) => (
              <li key={m.user.id} className="criteria__item">
                <span>
                  <strong>{m.user.name}</strong> · {ROLE[m.role]} · {m.allocationPct} %
                </span>
                {m.activeTotal !== 100 ? (
                  <span className="field__error">
                    Por realocar: soma {m.activeTotal} % nas equipas ativas (tem de ser 100 %).
                  </span>
                ) : null}
                <button
                  type="button"
                  className="button--link"
                  onClick={() => {
                    setNotice(undefined);
                    setEditing({ userId: m.user.id, userName: m.user.name });
                  }}
                >
                  Gerir as pertenças de {m.user.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {t.active && !editing ? (
          <div className="form form--inline">
            <SelectField label="Acrescentar membro" value={newMemberId} onChange={setNewMemberId} hint="Depois, ajuste as alocações para somarem 100 %.">
              <option value="">Escolha a conta</option>
              {(accounts.data?.items ?? [])
                .filter((a) => a.active && !memberIds.includes(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </SelectField>
            <div className="actions">
              <button
                type="button"
                disabled={!newMemberId}
                onClick={() => {
                  const account = accounts.data?.items.find((a) => a.id === newMemberId);
                  setNotice(undefined);
                  if (account) setEditing({ userId: account.id, userName: account.name, addTeamId: teamId });
                  setNewMemberId('');
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        ) : null}

        {editing ? (
          <MembershipEditor
            key={editing.userId}
            userId={editing.userId}
            userName={editing.userName}
            addTeamId={editing.addTeamId}
            onOperationStart={() => setNotice(undefined)}
            onCancel={() => setEditing(null)}
            onDone={(message) => {
              setEditing(null);
              setNotice(message);
            }}
          />
        ) : null}
      </section>

      {confirming ? (
        <ConfirmDialog
          title="Desativar equipa"
          confirmLabel="Desativar equipa"
          busy={deactivate.isPending}
          error={deactivate.error ? errorText(deactivate.error) : undefined}
          onConfirm={() => deactivate.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            A equipa «{t.name}» deixa de receber tarefas e não pode ser reativada. O histórico e as pertenças mantêm-se; os membros
            terão de ser realocados nas outras equipas.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
