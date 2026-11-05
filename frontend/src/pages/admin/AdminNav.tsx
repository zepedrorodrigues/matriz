import { NavLink } from 'react-router';

/** Navegação da área de administração (§3.1: só o administrador). As equipas chegam no passo 2 do I3. */
export function AdminNav() {
  return (
    <nav aria-label="Administração" className="breadcrumbs app-nav">
      <NavLink to="/administracao/contas">Contas</NavLink>
    </nav>
  );
}
