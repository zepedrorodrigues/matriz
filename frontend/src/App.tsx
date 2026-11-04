import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { ApiError, getCurrentUser, type CurrentUser } from './api/client';
import { StatusScreen } from './auth/AuthGate';

const ROLE_LABEL = { leader: 'Líder', member: 'Membro' } as const;

/**
 * I1 — aplicação com sessão iniciada: utilizador autenticado (`GET /me`) e fim de sessão.
 * O painel inicial, os projetos e as tarefas chegam nos incrementos seguintes (I2, I4, I8).
 */
export function App() {
  const auth = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: getCurrentUser, retry: false });
  const signOut = () => void auth.signoutRedirect();

  if (me.isPending) return <StatusScreen message="A carregar o seu perfil…" />;

  if (me.isError) {
    const noAccount = me.error instanceof ApiError && me.error.status === 403;
    return (
      <StatusScreen
        tone="error"
        message={
          noAccount
            ? 'Não existe uma conta ativa na Matriz para o seu utilizador. Peça ao administrador para a criar.'
            : 'Não foi possível carregar o seu perfil. Tente novamente mais tarde.'
        }
      >
        <button type="button" onClick={signOut}>
          Terminar sessão
        </button>
      </StatusScreen>
    );
  }

  return (
    <>
      <header className="app-header">
        <span className="app-header__brand">Matriz</span>
        <span className="app-header__user">{me.data.name}</span>
        <button type="button" onClick={signOut}>
          Terminar sessão
        </button>
      </header>
      <main className="page">
        <h1>Olá, {me.data.name}</h1>
        <Profile user={me.data} />
      </main>
    </>
  );
}

function Profile({ user }: { user: CurrentUser }) {
  return (
    <dl className="profile">
      <dt>E-mail profissional</dt>
      <dd>{user.workEmail}</dd>
      <dt>Papel global</dt>
      <dd>{user.isAdmin ? 'Administrador' : '—'}</dd>
      <dt>Equipas</dt>
      <dd>
        {user.teams.length === 0
          ? 'Não pertence a nenhuma equipa.'
          : user.teams.map((t) => `${t.teamName} (${ROLE_LABEL[t.role]}, ${t.allocationPct}%)`).join('; ')}
      </dd>
      <dt>Projetos que gere</dt>
      <dd>{user.managedProjectIds.length}</dd>
    </dl>
  );
}
