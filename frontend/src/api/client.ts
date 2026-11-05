import { readAccessToken } from '../auth/access-token';
import type { Priority, TaskState } from '../domain/tasks';

export type { Priority, TaskState };

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

export interface UserSummary {
  id: string;
  name: string;
}

/** openapi.yaml: Epic e Objective (RN12). */
export interface Epic {
  id: string;
  objectiveId: string;
  title: string;
  description: string | null;
}

export interface Objective {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  epics: Epic[];
}

/** openapi.yaml: TaskSummary */
export interface TaskSummary {
  id: string;
  title: string;
  state: TaskState;
  priority: Priority;
  teamId: string;
  assignee: UserSummary | null;
  estimateHours: number | null;
  storyPoints: number | null;
  isBlocked: boolean;
  isOverdue: boolean;
  subtaskCount: number;
}

/** openapi.yaml: AcceptanceCriterion */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  isMet: boolean;
  metBy: UserSummary | null;
  metAt: string | null;
}

/** openapi.yaml: Task */
export interface Task extends Omit<TaskSummary, 'subtaskCount'> {
  projectId: string;
  epicId: string | null;
  parentTaskId: string | null;
  description: string | null;
  originalTeamId: string;
  dueDate: string | null;
  blockReason: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  participants: { user: UserSummary; addedBy: UserSummary; addedAt: string }[];
  subtasks: TaskSummary[];
  createdBy: UserSummary;
  createdAt: string;
}

/** openapi.yaml: TaskPage */
export interface TaskPage {
  page: number;
  pageSize: number;
  total: number;
  items: TaskSummary[];
}

export interface ElementInput {
  title: string;
  description?: string;
}

/** openapi.yaml: TaskCreate — `epicId` e `teamId` numa tarefa, ou `parentTaskId` numa subtarefa. */
export interface TaskCreate {
  epicId?: string;
  teamId?: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  estimateHours?: number;
  storyPoints?: number;
}

/** openapi.yaml: TaskUpdate (título, descrição, prioridade e estimativas; `null` deixa sem valor). */
export interface TaskUpdate {
  title?: string;
  description?: string | null;
  priority?: Priority;
  estimateHours?: number | null;
  storyPoints?: number | null;
}

const id = (value: string) => encodeURIComponent(value);

export const listObjectives = (projectId: string) => apiGet<Objective[]>(`/projects/${id(projectId)}/objectives`);
export const createObjective = (projectId: string, input: ElementInput) =>
  apiRequest<Objective>('POST', `/projects/${id(projectId)}/objectives`, input);
export const createEpic = (objectiveId: string, input: ElementInput) =>
  apiRequest<Epic>('POST', `/objectives/${id(objectiveId)}/epics`, input);

export function listTasks(projectId: string, params: { state?: TaskState; priority?: Priority; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.state) search.set('state', params.state);
  if (params.priority) search.set('priority', params.priority);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return apiGet<TaskPage>(`/projects/${id(projectId)}/tasks${qs ? `?${qs}` : ''}`);
}

export const createTask = (projectId: string, input: TaskCreate) =>
  apiRequest<Task>('POST', `/projects/${id(projectId)}/tasks`, input);
export const getTask = (taskId: string) => apiGet<Task>(`/tasks/${id(taskId)}`);
export const updateTask = (taskId: string, input: TaskUpdate) => apiRequest<Task>('PATCH', `/tasks/${id(taskId)}`, input);
export const changeTaskState = (taskId: string, state: TaskState) =>
  apiRequest<Task>('POST', `/tasks/${id(taskId)}/state`, { state });
export const deleteTask = (taskId: string) => apiRequest<void>('DELETE', `/tasks/${id(taskId)}`);

/** openapi.yaml: createAcceptanceCriterion, updateAcceptanceCriterion (RN13, RN24). */
export const createCriterion = (taskId: string, input: { description: string }) =>
  apiRequest<AcceptanceCriterion>('POST', `/tasks/${id(taskId)}/acceptance-criteria`, input);
export const updateCriterion = (taskId: string, criterionId: string, input: { description?: string; isMet?: boolean }) =>
  apiRequest<AcceptanceCriterion>('PATCH', `/tasks/${id(taskId)}/acceptance-criteria/${id(criterionId)}`, input);
