import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { listAlerts, type CurrentUser } from '@/api/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { alertsNavLabel } from '@/domain/alerts';
import { initials, roleSummary } from '@/domain/people';
import { cn } from '@/lib/utils';

const navItem = (active: boolean) =>
  cn(
    'inline-flex items-center gap-2 rounded-md px-3 min-h-10 text-sm font-medium text-muted-foreground transition-colors',
    'hover:bg-muted hover:text-foreground',
    active && 'bg-accent text-accent-foreground font-semibold hover:bg-accent hover:text-accent-foreground',
  );

/**
 * Cabeçalho da aplicação (direção «B · Quadro», DT17): marca, navegação principal, alertas por ler e menu
 * do utilizador. A Administração aparece só ao administrador; a API recusa sempre a quem não o é (SEC02).
 */
export function AppHeader({ user, onSignOut }: { user: CurrentUser; onSignOut: () => void }) {
  const { pathname } = useLocation();
  // «Sprints» abre o planeamento da equipa e continua ativo dentro de uma sprint.
  const inPlanning = pathname.startsWith('/planeamento') || pathname.startsWith('/sprints/');
  const inAdmin = pathname.startsWith('/administracao');

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2 rounded-md text-foreground no-underline">
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            M
          </span>
          <span className="text-base font-bold">Matriz</span>
        </Link>

        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => navItem(isActive)}>
            Início
          </NavLink>
          <NavLink to="/projetos" className={({ isActive }) => navItem(isActive)}>
            Projetos
          </NavLink>
          <NavLink to="/planeamento" className={() => navItem(inPlanning)} aria-current={inPlanning ? 'page' : undefined}>
            Sprints
          </NavLink>
          <AlertsLink />
          {user.isAdmin ? (
            <NavLink to="/administracao/contas" className={() => navItem(inAdmin)} aria-current={inAdmin ? 'page' : undefined}>
              Administração
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto">
          <UserMenu user={user} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}

/**
 * Alertas por ler (RN18). DT07: consultados a cada minuto e depois de cada alteração confirmada (main.tsx).
 * O nome acessível é o mesmo de antes («Alertas (3)»); o número aparece também num distintivo.
 */
function AlertsLink() {
  const unread = useQuery({ queryKey: ['alerts', 'unread'], queryFn: () => listAlerts(1, 1), refetchInterval: 60_000 });
  const count = unread.data?.unreadCount ?? 0;
  return (
    <NavLink to="/alertas" aria-label={alertsNavLabel(count)} className={({ isActive }) => navItem(isActive)}>
      <Bell className="size-4" aria-hidden="true" />
      Alertas
      {count > 0 ? (
        <span aria-hidden="true" className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-bold leading-5 text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </NavLink>
  );
}

function UserMenu({ user, onSignOut }: { user: CurrentUser; onSignOut: () => void }) {
  const role = roleSummary(user);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-h-10 items-center gap-2 rounded-md px-2 text-left hover:bg-muted"
        aria-label={`Menu do utilizador: ${user.name}, ${role}`}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.workEmail}</span>
          <span className="text-xs font-normal text-muted-foreground">{role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut aria-hidden="true" />
          Terminar sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
