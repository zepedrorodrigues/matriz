import { readAccessToken } from '../auth/access-token';
import { oidcAuthority, oidcClientId } from '../auth/runtime-config';
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
  const token = readAccessToken(sessionStorage, oidcAuthority, oidcClientId);
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

/** openapi.yaml: UserAccount, UserAccountPage, UserCreate (CA01.13, RN35) — só o administrador. */
export interface UserAccount {
  id: string;
  name: string;
  workEmail: string;
  isAdmin: boolean;
  active: boolean;
  linked: boolean;
  createdAt: string;
}
export interface UserAccountPage {
  page: number;
  pageSize: number;
  total: number;
  items: UserAccount[];
}
export function listUsers(params: { q?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return apiGet<UserAccountPage>(`/users${qs ? `?${qs}` : ''}`);
}
export const createUser = (input: { name: string; workEmail: string }) => apiRequest<UserAccount>('POST', '/users', input);

/** openapi.yaml: TeamSummary, TeamDetail, UserMemberships (US01; RN06, RN33, RN34; F18). */
export type TeamRole = 'leader' | 'member';
export interface TeamSummary {
  id: string;
  name: string;
  active: boolean;
}
export interface TeamDetail extends TeamSummary {
  deactivatedAt: string | null;
  createdAt: string;
  openTaskCount: number;
  members: { user: UserSummary; role: TeamRole; allocationPct: number; activeTotal: number }[];
}
export interface Membership {
  teamId: string;
  role: TeamRole;
  allocationPct: number;
}
export interface UserMemberships {
  userId: string;
  activeTotal: number;
  memberships: (Membership & { teamName: string; teamActive: boolean })[];
}
export interface TeamCreate {
  name: string;
  leaderId: string;
  leaderAllocationPct: number;
  leaderOtherAllocations: { teamId: string; allocationPct: number }[];
}
export const listTeams = () => apiGet<TeamSummary[]>('/teams');
/** openapi.yaml: addProjectTeam (CA01.3, CA01.5) — devolve as equipas do projeto. */
export const addProjectTeam = (projectId: string, teamId: string) =>
  apiRequest<TeamSummary[]>('POST', `/projects/${id(projectId)}/teams`, { teamId });
export const getTeam = (teamId: string) => apiGet<TeamDetail>(`/teams/${id(teamId)}`);
export const createTeam = (input: TeamCreate) => apiRequest<TeamDetail>('POST', '/teams', input);
export const renameTeam = (teamId: string, name: string) => apiRequest<TeamDetail>('PATCH', `/teams/${id(teamId)}`, { name });
export const deactivateTeam = (teamId: string) => apiRequest<TeamDetail>('POST', `/teams/${id(teamId)}/deactivate`);
export const getUserMemberships = (userId: string) => apiGet<UserMemberships>(`/users/${id(userId)}/memberships`);
export const replaceUserMemberships = (userId: string, memberships: Membership[]) =>
  apiRequest<UserMemberships>('PUT', `/users/${id(userId)}/memberships`, { memberships });

/** openapi.yaml: Sprint, SprintDetail, PlanningTask, BacklogPage (US04; RN31, RN36, RN37). */
export type SprintStatus = 'planned' | 'active' | 'closed';
export interface Sprint {
  id: string;
  teamId: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: SprintStatus;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}
export interface PlanningTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  parentTaskId: string | null;
  state: TaskState;
  priority: Priority;
  estimateHours: number | null;
  storyPoints: number | null;
  assignee: UserSummary | null;
  plannable: boolean;
}
export interface SprintTask extends PlanningTask {
  plannedAt: string;
  addedAfterStart: boolean;
  startEstimateHours: number | null;
  startStoryPoints: number | null;
  leftAt: string | null;
  leftReason: 'sprint_ended' | 'removed' | 'transferred' | null;
}
export interface SprintDetail extends Sprint {
  tasks: SprintTask[];
  leftTasks: SprintTask[];
}
export interface BacklogPage {
  page: number;
  pageSize: number;
  total: number;
  items: (PlanningTask & { plannedSprintId: string | null })[];
}
export interface SprintDates {
  startDate: string;
  endDate: string;
}
/** openapi.yaml: TeamWork (CA07.1, CA07.3, CA07.4) e SprintProgress (CA07.2). */
export type WorkGroup = 'planned' | 'in_progress' | 'done' | 'blocked' | 'overdue';
export interface TeamWork {
  page: number;
  pageSize: number;
  total: number;
  counts: Record<WorkGroup, number>;
  items: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    parentTaskId: string | null;
    state: TaskState;
    priority: Priority;
    assignee: UserSummary | null;
    dueDate: string | null;
    isOverdue: boolean;
    isBlocked: boolean;
    blockReason: string | null;
  }[];
}
export function getTeamWork(teamId: string, params: { group?: WorkGroup; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.group) search.set('group', params.group);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 20));
  return apiGet<TeamWork>(`/teams/${id(teamId)}/work?${search.toString()}`);
}
export interface WorkTotals {
  startHours: number | null;
  currentHours: number;
  startStoryPoints: number | null;
  currentStoryPoints: number;
  tasks: number;
}
export interface SprintProgress {
  sprintId: string;
  status: SprintStatus;
  planned: WorkTotals;
  done: WorkTotals;
  tasks: {
    id: string;
    title: string;
    state: TaskState;
    startEstimateHours: number | null;
    currentEstimateHours: number | null;
    startStoryPoints: number | null;
    currentStoryPoints: number | null;
    addedAfterStart: boolean;
    leftReason: 'sprint_ended' | 'removed' | 'transferred' | null;
    done: boolean;
  }[];
}
export const getSprintProgress = (sprintId: string) => apiGet<SprintProgress>(`/sprints/${id(sprintId)}/progress`);

/** openapi.yaml: SprintCapacity, MemberCapacity (US05; RN06, RN19; SEC07: `members` filtrado). */
export interface MemberCapacity {
  userId: string;
  name: string;
  role: 'leader' | 'member';
  allocationPct: number;
  capacityHours: number;
  availabilityAdjusted: boolean;
  plannedHours: number;
  remainingHours: number;
  overloaded: boolean;
}
export interface SprintCapacity {
  sprintId: string;
  teamId: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  capacityHours: number;
  plannedHours: number;
  remainingHours: number;
  plannedStoryPoints: number;
  tasksWithoutStoryPoints: number;
  overloaded: boolean;
  members: MemberCapacity[];
}
export const getSprintCapacity = (sprintId: string) => apiGet<SprintCapacity>(`/sprints/${id(sprintId)}/capacity`);
export const setAvailability = (sprintId: string, userId: string, availableHours: number) =>
  apiRequest<SprintCapacity>('PUT', `/sprints/${id(sprintId)}/availability/${id(userId)}`, { availableHours });
export const resetAvailability = (sprintId: string, userId: string) =>
  apiRequest<SprintCapacity>('DELETE', `/sprints/${id(sprintId)}/availability/${id(userId)}`);

export const listTeamSprints = (teamId: string) => apiGet<Sprint[]>(`/teams/${id(teamId)}/sprints`);
export const createSprint = (teamId: string, dates: SprintDates) => apiRequest<SprintDetail>('POST', `/teams/${id(teamId)}/sprints`, dates);
export const getTeamBacklog = (teamId: string, page = 1, pageSize = 100) =>
  apiGet<BacklogPage>(`/teams/${id(teamId)}/backlog?page=${page}&pageSize=${pageSize}`);
export const getSprint = (sprintId: string) => apiGet<SprintDetail>(`/sprints/${id(sprintId)}`);
export const updateSprintDates = (sprintId: string, dates: SprintDates) => apiRequest<SprintDetail>('PATCH', `/sprints/${id(sprintId)}`, dates);
export const startSprint = (sprintId: string, dates?: SprintDates) => apiRequest<SprintDetail>('POST', `/sprints/${id(sprintId)}/start`, dates ?? {});
export const planSprintTask = (sprintId: string, taskId: string) =>
  apiRequest<SprintDetail>('POST', `/sprints/${id(sprintId)}/tasks`, { taskId });
export const removeSprintTask = (sprintId: string, taskId: string) =>
  apiRequest<SprintDetail>('DELETE', `/sprints/${id(sprintId)}/tasks/${id(taskId)}`);

/** openapi.yaml: Dashboard — projetos visíveis com o número de tarefas por estado (CA07.9). */
export interface Dashboard {
  projects: { id: string; name: string; taskCounts: Record<TaskState, number>; totalTasks: number }[];
}
export const getDashboard = () => apiGet<Dashboard>('/dashboard');

/** openapi.yaml: Alert, AlertPage — só os alertas do próprio utilizador (RN18, RN30; SEC07). */
export type AlertType = 'deadline_passed' | 'task_blocked' | 'task_reopened' | 'member_task_created' | 'team_overload' | 'individual_overload';
export interface Alert {
  id: string;
  type: AlertType;
  createdAt: string;
  readAt: string | null;
  task: { id: string; title: string; state: TaskState; isBlocked: boolean; blockReason: string | null } | null;
  team: TeamSummary | null;
  member: UserSummary | null;
  sprintId: string | null;
  dueDate: string | null;
}
export interface AlertPage {
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
  items: Alert[];
}
export const listAlerts = (page = 1, pageSize = 20) => apiGet<AlertPage>(`/alerts?page=${page}&pageSize=${pageSize}`);
export const markAlertRead = (alertId: string) => apiRequest<Alert>('POST', `/alerts/${id(alertId)}/read`);

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

/** openapi.yaml: Participant (RN40) */
export interface Participant {
  user: UserSummary;
  addedBy: UserSummary;
  addedAt: string;
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
  participants: Participant[];
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
  /** RN29: AAAA-MM-DD. */
  dueDate?: string;
}

/** openapi.yaml: TaskUpdate (título, descrição, prioridade e estimativas; `null` deixa sem valor). */
export interface TaskUpdate {
  title?: string;
  description?: string | null;
  priority?: Priority;
  estimateHours?: number | null;
  storyPoints?: number | null;
  /** CA03.3, CA09.1: `null` retira o responsável; a justificação é obrigatória para outra equipa (RN03). */
  assigneeId?: string | null;
  assignmentJustification?: string;
  /** RN29, F21: `null` retira o prazo. */
  dueDate?: string | null;
  /** RN28, CA07.6: bloquear exige o motivo. */
  isBlocked?: boolean;
  blockReason?: string | null;
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

/** openapi.yaml: TaskTransfer (RN14, RN20, RN22; US09). */
export interface TaskTransfer {
  taskId: string;
  previousTeamId: string;
  newTeamId: string;
  originalTeamId: string;
  transferredSubtaskIds: string[];
  removedFromSprintId: string | null;
  transferredBy: string;
  transferredAt: string;
}
export const transferTask = (taskId: string, targetTeamId: string) =>
  apiRequest<TaskTransfer>('POST', `/tasks/${id(taskId)}/transfer`, { targetTeamId });
export const updateTask = (taskId: string, input: TaskUpdate) => apiRequest<Task>('PATCH', `/tasks/${id(taskId)}`, input);
export const changeTaskState = (taskId: string, state: TaskState) =>
  apiRequest<Task>('POST', `/tasks/${id(taskId)}/state`, { state });
export const deleteTask = (taskId: string) => apiRequest<void>('DELETE', `/tasks/${id(taskId)}`);

/** openapi.yaml: listEligibleUsers, listParticipants, addParticipant, removeParticipant (RN03, RN40). */
export const listEligibleUsers = (taskId: string, scope: 'team' | 'all' = 'team') =>
  apiGet<UserSummary[]>(`/tasks/${id(taskId)}/eligible-users?scope=${scope}`);
export const addParticipant = (taskId: string, input: { userId: string; justification?: string }) =>
  apiRequest<Participant>('POST', `/tasks/${id(taskId)}/participants`, input);
export const removeParticipant = (taskId: string, userId: string) =>
  apiRequest<void>('DELETE', `/tasks/${id(taskId)}/participants/${id(userId)}`);

/** openapi.yaml: Comment, CommentPage (RN41) */
export interface Comment {
  id: string;
  taskId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}
export interface CommentPage {
  page: number;
  pageSize: number;
  total: number;
  items: Comment[];
}

/** openapi.yaml: listComments, addComment (CA10.1, CA10.2). O autor e a data vêm do backend (CA10.5). */
export const listComments = (taskId: string, page: number, pageSize = 20) =>
  apiGet<CommentPage>(`/tasks/${id(taskId)}/comments?page=${page}&pageSize=${pageSize}`);
export const addComment = (taskId: string, body: string) =>
  apiRequest<Comment>('POST', `/tasks/${id(taskId)}/comments`, { body });

/** openapi.yaml: createAcceptanceCriterion, updateAcceptanceCriterion (RN13, RN24). */
export const createCriterion = (taskId: string, input: { description: string }) =>
  apiRequest<AcceptanceCriterion>('POST', `/tasks/${id(taskId)}/acceptance-criteria`, input);
export const updateCriterion = (taskId: string, criterionId: string, input: { description?: string; isMet?: boolean }) =>
  apiRequest<AcceptanceCriterion>('PATCH', `/tasks/${id(taskId)}/acceptance-criteria/${id(criterionId)}`, input);
