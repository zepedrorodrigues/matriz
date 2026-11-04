import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, type CurrentUser } from '../api/client';

/** Utilizador autenticado (`GET /me`), partilhado pelos ecrãs. */
export const useCurrentUser = () => useQuery({ queryKey: ['me'], queryFn: getCurrentUser, retry: false });

/**
 * Regras da matriz de permissões (requirements.md §3.1) usadas só para mostrar ou esconder ações na
 * interface. A decisão é sempre do backend (SEC02): uma ação escondida também é recusada pela API.
 */
export const canCreateProject = (me: CurrentUser) => me.isAdmin || me.teams.some((t) => t.role === 'leader');
export const canManageProject = (me: CurrentUser, projectId: string) =>
  me.isAdmin || me.managedProjectIds.includes(projectId);
