import { readAccessToken } from '../auth/access-token';

/**
 * Cliente da API. O endereço base fica centralizado aqui: em desenvolvimento o Vite encaminha
 * /api para o backend e em produção o proxy faz o mesmo (mesma origem, architecture.md §8).
 * Cada pedido leva o token de acesso (DT04); um 401 termina a sessão na interface.
 */
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

  /** Mensagens de validação por campo (400), para mostrar junto de cada campo do formulário. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.problem?.errors ?? []) if (!out[e.field]) out[e.field] = e.message;
    return out;
  }
}

let onUnauthorized: () => void = () => {};

/** Reação a um 401 da API (sessão inválida), registada pelo AuthGate. */
export function onSessionInvalid(handler: () => void): void {
  onUnauthorized = handler;
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Lido no momento do pedido, e não passado por um efeito do React (ver auth/access-token.ts).
  const token = readAccessToken(sessionStorage, import.meta.env.VITE_OIDC_AUTHORITY, import.meta.env.VITE_OIDC_CLIENT_ID);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let problem: Problem | undefined;
    if (res.headers.get('content-type')?.includes('json')) problem = (await res.json()) as Problem;
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, problem);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => apiRequest<T>('GET', path);

/** openapi.yaml: CurrentUser */
export interface CurrentUser {
  id: string;
  name: string;
  workEmail: string;
  isAdmin: boolean;
  teams: { teamId: string; teamName: string; role: 'leader' | 'member'; allocationPct: number }[];
  managedProjectIds: string[];
}

/** openapi.yaml: ProjectSummary */
export interface ProjectSummary {
  id: string;
  name: string;
  objective: string | null;
  createdAt: string;
}

/** openapi.yaml: Project */
export interface Project extends ProjectSummary {
  managers: { id: string; name: string }[];
  teams: { id: string; name: string; active: boolean }[];
}

/** openapi.yaml: ProjectPage */
export interface ProjectPage {
  page: number;
  pageSize: number;
  total: number;
  items: ProjectSummary[];
}

export interface ProjectInput {
  name: string;
  objective?: string;
}

export const getCurrentUser = () => apiGet<CurrentUser>('/me');

export function listProjects(params: { q?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return apiGet<ProjectPage>(`/projects${qs ? `?${qs}` : ''}`);
}

export const getProject = (id: string) => apiGet<Project>(`/projects/${encodeURIComponent(id)}`);
export const createProject = (input: ProjectInput) => apiRequest<Project>('POST', '/projects', input);
export const updateProject = (id: string, input: Partial<ProjectInput>) =>
  apiRequest<Project>('PATCH', `/projects/${encodeURIComponent(id)}`, input);
export const deleteProject = (id: string) => apiRequest<void>('DELETE', `/projects/${encodeURIComponent(id)}`);
