import { SetMetadata } from '@nestjs/common';

/**
 * Permissão exigida por uma rota, avaliada pelo guarda global do módulo Identidade e acesso segundo
 * a matriz de permissões (requirements.md §3.1, SEC02). Os módulos declaram a permissão sem
 * dependerem do módulo Identidade (architecture.md §6).
 */
export type ProjectAction = 'view' | 'edit' | 'delete' | 'createWork' | 'createTask';
/**
 * `createCriterion`/`updateCriterion`: acrescentar e alterar critérios de aceitação (RN24, §3.1).
 * `listEligible`: utilizadores elegíveis (`scope` na query); `addParticipant`/`removeParticipant`: RN40.
 */
export type TaskAction =
  | 'view'
  | 'edit'
  | 'changeState'
  | 'delete'
  | 'createCriterion'
  | 'updateCriterion'
  | 'listEligible'
  | 'addParticipant'
  | 'removeParticipant';

export type AccessRequirement =
  | { kind: 'admin' }
  | { kind: 'createProject' }
  | { kind: 'project'; action: ProjectAction; param: string }
  | { kind: 'objective'; action: 'createWork'; param: string }
  | { kind: 'task'; action: TaskAction; param: string }
  | { kind: 'team'; action: TeamPlanningAction; param: string }
  | { kind: 'sprint'; action: SprintAction; param: string };

/** Planeamento (§3.1): consultar — membros da equipa e administrador; gerir sprints e planear — só o líder. */
export type TeamPlanningAction = 'viewPlanning' | 'managePlanning';
/** `start`: iniciar a sprint — o líder da equipa ou o administrador (RN36). */
export type SprintAction = 'view' | 'manage' | 'start';

export const ACCESS_REQUIREMENT = 'matriz:accessRequirement';

/** Só o administrador: gerir contas, equipas e pertenças (§3.1, «Gerir utilizadores, papéis e equipas»). */
export const AdminOnly = () => SetMetadata(ACCESS_REQUIREMENT, { kind: 'admin' } satisfies AccessRequirement);

/** Operação de planeamento da equipa indicada no parâmetro de rota (I9). Equipa inexistente → 404. */
export const TeamPlanningAccess = (action: TeamPlanningAction, param = 'teamId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'team', action, param } satisfies AccessRequirement);

/** Operação sobre a sprint indicada no parâmetro de rota (I9). Sprint inexistente → 404. */
export const SprintAccess = (action: SprintAction, param = 'sprintId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'sprint', action, param } satisfies AccessRequirement);

/** Criar projetos: administrador ou líder de equipa (RN25, D48). */
export const CanCreateProject = () => SetMetadata(ACCESS_REQUIREMENT, { kind: 'createProject' } satisfies AccessRequirement);

/**
 * Operação sobre o projeto indicado no parâmetro de rota. Projeto inexistente, eliminado (RN38) ou
 * com identificador mal formado → 404; existente mas sem permissão → 403.
 * `createWork`: criar objetivos; `createTask`: criar tarefas e subtarefas (a equipa vem do corpo).
 */
export const ProjectAccess = (action: ProjectAction, param = 'projectId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'project', action, param } satisfies AccessRequirement);

/** Criar épicos num objetivo: as mesmas regras de criar objetivos no projeto do objetivo. */
export const ObjectiveAccess = (action: 'createWork', param = 'objectiveId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'objective', action, param } satisfies AccessRequirement);

/**
 * Operação sobre a tarefa indicada no parâmetro de rota. Tarefa inexistente, eliminada, de um projeto
 * eliminado (RN38) ou com identificador mal formado → 404; existente mas sem permissão → 403.
 */
export const TaskAccess = (action: TaskAction, param = 'taskId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'task', action, param } satisfies AccessRequirement);
