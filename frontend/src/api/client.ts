/**
 * Cliente da API. O endereço base fica centralizado aqui: em desenvolvimento o Vite encaminha
 * /api para o backend e em produção o proxy faz o mesmo (mesma origem, architecture.md §8).
 * Cada pedido leva o token de acesso (DT04); um 401 termina a sessão na interface.
 */
import { readAccessToken } from '../auth/access-token';

const API_BASE = '/api';

/** Erro no formato RFC 9457 (openapi.yaml: Problem). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem?: Problem,
  ) {
    super(problem?.detail ?? problem?.title ?? `O pedido falhou com o código ${status}.`);
  }
}

let onUnauthorized: () => void = () => {};

/** Reação a um 401 da API (sessão inválida), registada pelo AuthGate. */
export function onSessionInvalid(handler: () => void): void {
  onUnauthorized = handler;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Lido no momento do pedido, e não passado por um efeito do React (ver auth/access-token.ts).
  const token = readAccessToken(sessionStorage, import.meta.env.VITE_OIDC_AUTHORITY, import.meta.env.VITE_OIDC_CLIENT_ID);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    let problem: Problem | undefined;
    if (res.headers.get('content-type')?.includes('json')) problem = (await res.json()) as Problem;
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, problem);
  }
  return (await res.json()) as T;
}

/** openapi.yaml: Health */
export interface Health {
  status: 'ok' | 'unavailable';
  database: 'ok' | 'unavailable';
}

/** openapi.yaml: CurrentUser */
export interface CurrentUser {
  id: string;
  name: string;
  workEmail: string;
  isAdmin: boolean;
  teams: { teamId: string; teamName: string; role: 'leader' | 'member'; allocationPct: number }[];
  managedProjectIds: string[];
}

export const getHealth = () => apiGet<Health>('/health');
export const getCurrentUser = () => apiGet<CurrentUser>('/me');
