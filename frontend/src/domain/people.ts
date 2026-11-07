import type { CurrentUser } from '../api/client';

const ROLE_LABEL = { leader: 'Líder', member: 'Membro' } as const;

/** Iniciais para o avatar: primeira letra do primeiro e do último nome, em maiúsculas. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Papel mostrado junto ao nome no cabeçalho: «Administrador», ou o papel e a equipa da primeira equipa,
 * com «+N» quando pertence a mais (as equipas e os papéis vêm de GET /me).
 */
export function roleSummary(user: Pick<CurrentUser, 'isAdmin' | 'teams'>): string {
  if (user.isAdmin) return 'Administrador';
  if (user.teams.length === 0) return 'Sem equipa';
  const [first, ...rest] = user.teams;
  const more = rest.length > 0 ? ` +${rest.length}` : '';
  return `${ROLE_LABEL[first.role]} · ${first.teamName}${more}`;
}
