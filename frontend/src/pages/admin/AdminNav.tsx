import { NavLink } from 'react-router';

/** Navegação da área de administração (§3.1: só o administrador). */
export function AdminNav() {
  return (
    <nav aria-label="Administração" className="breadcrumbs app-nav">
      <NavLink to="/administracao/contas">Contas</NavLink>
      <NavLink to="/administracao/equipas">Equipas</NavLink>
    </nav>
  );
}
