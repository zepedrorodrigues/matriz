import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
    isActive && 'bg-card text-foreground shadow-xs hover:bg-card',
  );

/** Navegação da área de administração (§3.1: só o administrador). */
export function AdminNav() {
  return (
    <nav aria-label="Administração" className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
      <NavLink to="/administracao/contas" className={tab}>
        Contas
      </NavLink>
      <NavLink to="/administracao/equipas" className={tab}>
        Equipas
      </NavLink>
    </nav>
  );
}
