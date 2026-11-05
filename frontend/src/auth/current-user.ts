import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, type CurrentUser, type Project, type Task } from '../api/client';
import { DEVELOPMENT_STATES, MEMBER_STATES, lifecycleTargets, type TaskState } from '../domain/tasks';

/** Utilizador autenticado (`GET /me`), partilhado pelos ecrãs. */
export const useCurrentUser = () => useQuery({ queryKey: ['me'], queryFn: getCurrentUser, retry: false });

/**
 * Regras da matriz de permissões (requirements.md §3.1) usadas só para mostrar ou esconder ações na
 * interface. A decisão é sempre do backend (SEC02): uma ação escondida também é recusada pela API.
 */
export const canCreateProject = (me: CurrentUser) => me.isAdmin || me.teams.some((t) => t.role === 'leader');
export const canManageProject = (me: CurrentUser, projectId: string) =>
  me.isAdmin || me.managedProjectIds.includes(projectId);

const roleIn = (me: CurrentUser, teamId: string) => me.teams.find((t) => t.teamId === teamId)?.role;

/** §3.1: criar objetivos e épicos — administrador, gestor do projeto ou líder de uma equipa do projeto. */
export const canCreateWork = (me: CurrentUser, project: Project) =>
  canManageProject(me, project.id) || project.teams.some((t) => t.active && roleIn(me, t.id) === 'leader');

/** §3.1, RN21: equipas para onde o utilizador pode criar tarefas neste projeto. */
export const teamsForNewTask = (me: CurrentUser, project: Project) =>
  project.teams.filter((t) => t.active && (canManageProject(me, project.id) || roleIn(me, t.id) !== undefined));

/** Administrador, gestor do projeto ou líder da equipa responsável (RN38, RN39, RN26). */
export const leadsTask = (me: CurrentUser, task: Task) =>
  canManageProject(me, task.projectId) || roleIn(me, task.teamId) === 'leader';

/** D49: editar o título e a descrição — também qualquer membro da equipa responsável. */
export const canEditTask = (me: CurrentUser, task: Task) =>
  canManageProject(me, task.projectId) || roleIn(me, task.teamId) !== undefined;

/** Criar uma subtarefa: administrador, gestor ou quem pertence à equipa da tarefa principal (RN21, RN22). */
export const canCreateSubtask = canEditTask;

/** RN26: estados que este utilizador pode escolher para a tarefa. */
export function stateTargetsFor(me: CurrentUser, task: Task): TaskState[] {
  const targets = lifecycleTargets(task.state);
  if (leadsTask(me, task)) return targets;
  const mayMove = task.assignee?.id === me.id && MEMBER_STATES.includes(task.state);
  return mayMove ? targets.filter((s) => MEMBER_STATES.includes(s)) : [];
}

/**
 * §3.1, RN10: definem estimativas o administrador, o gestor e os membros da equipa responsável; em
 * «A desenvolver» ou depois, só o administrador, o gestor e o líder.
 */
export const canEditEstimates = (me: CurrentUser, task: Task) =>
  leadsTask(me, task) || (canEditTask(me, task) && !DEVELOPMENT_STATES.includes(task.state));

/**
 * RN24: definem e alteram os critérios o administrador, o gestor, o líder e, antes de «A desenvolver»,
 * quem criou a tarefa (se for da equipa responsável).
 */
export const canDefineCriteria = (me: CurrentUser, task: Task) =>
  leadsTask(me, task) ||
  (!DEVELOPMENT_STATES.includes(task.state) && roleIn(me, task.teamId) !== undefined && task.createdBy.id === me.id);

/** §3.1: registar o cumprimento — o membro, só nas tarefas que lhe estão atribuídas. */
export const canRecordCriteria = (me: CurrentUser, task: Task) =>
  leadsTask(me, task) || (roleIn(me, task.teamId) !== undefined && task.assignee?.id === me.id);

/** §3.1, CA03.3, CA03.6: atribuem o responsável e gerem os participantes o administrador, o gestor e o líder (RN40). */
export const canAssignTask = leadsTask;

/** RN03: só o administrador e o gestor escolhem alguém de outra equipa, com justificação. */
export const canChooseOtherTeams = (me: CurrentUser, task: Task) => canManageProject(me, task.projectId);
