import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Suspense, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Link, NavLink, Outlet } from 'react-router';
import { AppHeader } from '@/components/app-header';
import { ApiError, getDashboard, type CurrentUser } from './api/client';
import { StatusScreen } from './auth/AuthGate';
import { useCurrentUser } from './auth/current-user';
import { Notice } from './components/Notice';
import { STATE_LABEL, TASK_STATES } from './domain/tasks';

const ROLE_LABEL = { leader: 'Líder', member: 'Membro' } as const;

/**
 * Estrutura da aplicação com sessão iniciada: cabeçalho da direção «B · Quadro» (DT17, components/app-header.tsx)
 * e o ecrã da rota. Sprints (I9) abre o planeamento da equipa, com as sprints, o backlog e o trabalho da equipa
 * (acompanhamento, I11); Alertas (I11) mostra o número de alertas por ler.
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
        <div className="flex flex-wrap items-center gap-2">
          {noAccount ? null : (
            // Ex. 7: com o backend em baixo, o utilizador volta a tentar sem perder a sessão.
            <Button type="button" onClick={() => void me.refetch()} disabled={me.isFetching}>
              {me.isFetching ? 'A tentar…' : 'Tentar de novo'}
            </Button>
          )}
          <Button type="button" variant={noAccount ? 'default' : 'outline'} onClick={signOut}>
            Terminar sessão
          </Button>
        </div>
      </StatusScreen>
    );
  }

  return (
    <>
      <AppHeader user={me.data} onSignOut={signOut} />
      <main>
        {/* Cada ecrã é carregado à parte (main.tsx, React.lazy): enquanto chega, mostra-se o indicador. */}
        <Suspense fallback={<StatusScreen message="A carregar…" />}>
          <Outlet />
        </Suspense>
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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <h1 className="m-0 text-[22px] font-bold">Olá, {me.data.name}</h1>
      <Profile user={me.data} />

      <section aria-labelledby="dashboard-title">
        <h2 id="dashboard-title" className="m-0 text-base font-semibold">Os seus projetos</h2>
        {dashboard.isPending ? (
          <Notice>A carregar os projetos…</Notice>
        ) : dashboard.isError ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <Notice tone="error">Não foi possível carregar o painel. Verifique a ligação e tente de novo.</Notice>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}>
                {dashboard.isFetching ? 'A tentar…' : 'Tentar de novo'}
              </Button>
            </div>
          </div>
        ) : dashboard.data.projects.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">Ainda não tem acesso a nenhum projeto. Os projetos aparecem quando uma das suas equipas participa neles ou quando é gestor.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {dashboard.data.projects.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
                <Link to={`/projetos/${p.id}`} className="font-semibold text-foreground hover:underline">
                  {p.name}
                </Link>
                <p className="m-0 text-sm text-foreground/80">
                  {p.totalTasks === 1 ? '1 tarefa' : `${p.totalTasks} tarefas`}
                </p>
                <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2" aria-label={`Tarefas por estado em ${p.name}`}>
                  {TASK_STATES.map((s) => (
                    <div key={s} className={cn('rounded-lg bg-muted px-3 py-2 [&_dd]:m-0 [&_dd]:text-lg [&_dd]:font-bold [&_dt]:text-xs [&_dt]:text-muted-foreground', p.taskCounts[s] === 0 && 'opacity-60')}>
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
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Notice tone="error">Esta área é só para o administrador.</Notice>
        <NavLink to="/">Voltar ao início</NavLink>
      </section>
    );
  }
  return <>{children}</>;
}

export function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <h1 className="m-0 text-[22px] font-bold">Página não encontrada</h1>
      <NavLink to="/">Voltar ao início</NavLink>
    </section>
  );
}

function Profile({ user }: { user: CurrentUser }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border bg-card p-4 text-sm [&_dd]:m-0 [&_dd]:font-medium [&_dt]:text-muted-foreground">
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
