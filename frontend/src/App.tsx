import { useAuth } from 'react-oidc-context';
import { NavLink, Outlet } from 'react-router';
import { ApiError, type CurrentUser } from './api/client';
import { StatusScreen } from './auth/AuthGate';
import { useCurrentUser } from './auth/current-user';

const ROLE_LABEL = { leader: 'Líder', member: 'Membro' } as const;

/**
 * Estrutura da aplicação com sessão iniciada: cabeçalho com a navegação do wireframe (D47) e o
 * utilizador autenticado. As entradas Backlog, Sprints, Acompanhamento e Alertas aparecem com os
 * respetivos incrementos.
 */
export function Layout() {
  const auth = useAuth();
  const me = useCurrentUser();
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
        <nav aria-label="Principal" className="app-nav">
          <NavLink to="/" end>
            Início
          </NavLink>
          <NavLink to="/projetos">Projetos</NavLink>
        </nav>
        <span className="app-header__user">{me.data.name}</span>
        <button type="button" onClick={signOut}>
          Terminar sessão
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

/** Início provisório: perfil do utilizador. O painel inicial (Ex. 7, CA07.9) chega no I8. */
export function HomePage() {
  const me = useCurrentUser();
  if (!me.data) return null;
  return (
    <section className="page">
      <h1>Olá, {me.data.name}</h1>
      <Profile user={me.data} />
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>Página não encontrada</h1>
      <NavLink to="/">Voltar ao início</NavLink>
    </section>
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
