import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Link, NavLink, Outlet } from 'react-router';
import { ApiError, getDashboard, type CurrentUser } from './api/client';
import { StatusScreen } from './auth/AuthGate';
import { useCurrentUser } from './auth/current-user';
import { Notice } from './components/Notice';
import { STATE_LABEL, TASK_STATES } from './domain/tasks';

const ROLE_LABEL = { leader: 'Líder', member: 'Membro' } as const;

/**
 * Estrutura da aplicação com sessão iniciada: cabeçalho com a navegação do wireframe (D47) e o
 * utilizador autenticado. A Administração aparece só ao administrador (wireframe §1, §3.1). As
 * entradas Backlog, Sprints, Acompanhamento e Alertas aparecem com os respetivos incrementos.
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
            : 'Não foi possível carregar o seu perfil. Verifique a ligação e tente de novo.'
        }
      >
        <div className="actions">
          {noAccount ? null : (
            // Ex. 7: com o backend em baixo, o utilizador volta a tentar sem perder a sessão.
            <button type="button" onClick={() => void me.refetch()} disabled={me.isFetching}>
              {me.isFetching ? 'A tentar…' : 'Tentar de novo'}
            </button>
          )}
          <button type="button" className={noAccount ? undefined : 'button--secondary'} onClick={signOut}>
            Terminar sessão
          </button>
        </div>
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
          {me.data.isAdmin ? <NavLink to="/administracao/contas">Administração</NavLink> : null}
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

/**
 * Painel inicial (Ex. 7, CA07.9): utilizador autenticado e projetos que lhe são visíveis, com o número de
 * tarefas em cada estado e o total (todas as tarefas de topo do projeto, não uma página). As contagens
 * são pedidas de novo ao abrir o painel e depois de cada alteração confirmada pela API (main.tsx).
 */
export function HomePage() {
  const me = useCurrentUser();
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  if (!me.data) return null;
  return (
    <section className="page">
      <h1>Olá, {me.data.name}</h1>
      <Profile user={me.data} />

      <section aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">Os seus projetos</h2>
        {dashboard.isPending ? (
          <Notice>A carregar os projetos…</Notice>
        ) : dashboard.isError ? (
          <div className="panel">
            <Notice tone="error">Não foi possível carregar o painel. Verifique a ligação e tente de novo.</Notice>
            <div className="actions">
              <button type="button" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}>
                {dashboard.isFetching ? 'A tentar…' : 'Tentar de novo'}
              </button>
            </div>
          </div>
        ) : dashboard.data.projects.length === 0 ? (
          <p className="muted">Ainda não tem acesso a nenhum projeto. Os projetos aparecem quando uma das suas equipas participa neles ou quando é gestor.</p>
        ) : (
          <ul className="card-list">
            {dashboard.data.projects.map((p) => (
              <li key={p.id} className="card">
                <Link to={`/projetos/${p.id}`} className="card__title">
                  {p.name}
                </Link>
                <p className="card__text">
                  {p.totalTasks === 1 ? '1 tarefa' : `${p.totalTasks} tarefas`}
                </p>
                <dl className="state-counts" aria-label={`Tarefas por estado em ${p.name}`}>
                  {TASK_STATES.map((s) => (
                    <div key={s} className={p.taskCounts[s] === 0 ? 'state-counts__item state-counts__item--zero' : 'state-counts__item'}>
                      <dt>{STATE_LABEL[s]}</dt>
                      <dd>{p.taskCounts[s]}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

/** Rotas de administração: quem não é administrador vê a indicação, e a API recusa sempre (SEC02). */
export function AdminOnlyPage({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  if (!me.data) return null;
  if (!me.data.isAdmin) {
    return (
      <section className="page">
        <Notice tone="error">Esta área é só para o administrador.</Notice>
        <NavLink to="/">Voltar ao início</NavLink>
      </section>
    );
  }
  return <>{children}</>;
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
