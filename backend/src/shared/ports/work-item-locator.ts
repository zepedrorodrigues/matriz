import type { EntityManager } from 'typeorm';
import { todaySql } from '../config/time-zone';

/** Estados de uma tarefa (RN17), pela ordem do ciclo de vida (RN26). Valores técnicos do contrato. */
export const TASK_STATES = [
  'in_planning',
  'in_technical_analysis',
  'ready_for_development',
  'in_development',
  'in_testing',
  'done',
  'delivered',
] as const;
export type TaskState = (typeof TASK_STATES)[number];

/**
 * RN10, RN24: estados em que a tarefa está «depois de entrar em A desenvolver» — conta o estado atual;
 * se recuar para «Pronto a desenvolver» ou antes, a proteção deixa de se aplicar (decisão do humano,
 * 2026-11-05).
 */
export const DEVELOPMENT_STATES: readonly TaskState[] = ['in_development', 'in_testing', 'done', 'delivered'];

/**
 * RN26: tarefa concluída — «Terminada» ou «Entregue». Única definição, usada pelos módulos Trabalho e
 * Planeamento (I14, Ex. 9.2: antes repetida em três constantes e em literais SQL).
 */
export const DONE_STATES: readonly TaskState[] = ['done', 'delivered'];
/** A mesma lista para SQL: `t.state NOT IN (${DONE_STATES_SQL})` (valores fixos do código, não do pedido). */
export const DONE_STATES_SQL = DONE_STATES.map((s) => `'${s}'`).join(', ');

/** RF28: prazo ultrapassado no dia indicado (por omissão, hoje no fuso da aplicação) e tarefa não concluída (RN26). */
export const overdueSql = (day = todaySql()) => `coalesce(t.due_date < ${day} AND t.state NOT IN (${DONE_STATES_SQL}), false)`;

/** Tarefa vista pelo módulo Planeamento: o necessário para o backlog e as sprints (I9). */
export interface PlanningTaskInfo {
  id: string;
  title: string;
  projectId: string;
  teamId: string;
  parentTaskId: string | null;
  state: TaskState;
  priority: 'low' | 'medium' | 'high';
  /** Numa tarefa com subtarefas, a soma das subtarefas (RN22). */
  estimateHours: number | null;
  storyPoints: number | null;
  /** Tem subtarefas não eliminadas: na capacidade conta 0, contam as subtarefas (RN22, CA05.9). */
  hasSubtasks: boolean;
  dueDate: string | null;
  /** Prazo ultrapassado (no fuso da aplicação) e não concluída (RF28). */
  isOverdue: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  assigneeId: string | null;
  /** A atribuição atual é a exceção do RN03 (alguém de outra equipa, com justificação; F24). */
  assigneeCrossTeam: boolean;
  createdAt: string;
}

/** Onde está uma tarefa e quem responde por ela — o necessário para avaliar a matriz de permissões. */
export interface TaskLocation {
  projectId: string;
  teamId: string;
  assigneeId: string | null;
  /** A atribuição atual é a exceção do RN03 (F24): só ela dá ao responsável de outra equipa acesso à tarefa. */
  assigneeCrossTeam: boolean;
  parentTaskId: string | null;
  state: TaskState;
  /** Quem criou a tarefa: define os critérios antes de «A desenvolver» (RN24). */
  createdBy: string;
}

/**
 * Localização de elementos do módulo Trabalho, implementada pelo próprio módulo (dono das tabelas)
 * e usada pelo módulo Identidade e acesso para aplicar a matriz de permissões (requirements.md §3.1)
 * sem ler as tabelas de outro módulo (architecture.md §6).
 */
export interface WorkItemLocator {
  /** Tarefa ou subtarefa não eliminada (RN38), com o projeto herdado do épico (RN23); senão null. */
  /** `manager`: lê na transação de quem chama, sem ocupar outra ligação (I14, revisão). */
  locateTask(taskId: string, manager?: EntityManager): Promise<TaskLocation | null>;
  /**
   * Bloqueia as linhas das tarefas (FOR SHARE) na transação de quem chama, para que a equipa lida a seguir
   * não mude antes do fim da transação — p. ex. planear uma tarefa enquanto é transferida (RN01, RN20).
   */
  lockTasks(taskIds: string[], manager: EntityManager): Promise<void>;
  /** Projeto de um objetivo; null se não existir. */
  projectOfObjective(objectiveId: string): Promise<string | null>;
  /**
   * Número de tarefas por estado em cada projeto indicado — só tarefas de topo (sem subtarefas) e não
   * eliminadas (RN38; regra do contrato confirmada no Ex. 1). Os projetos sem tarefas ficam de fora.
   */
  taskCountsByProject(projectIds: string[]): Promise<Map<string, Partial<Record<TaskState, number>>>>;
  /**
   * Tarefas por concluir da equipa (CA01.10, RN33), por projeto: não eliminadas (nem a tarefa principal),
   * fora de «Terminada» e «Entregue», subtarefas incluídas. Quem chama exclui os projetos eliminados.
   */
  openTaskCountsOfTeam(teamId: string, manager?: EntityManager): Promise<{ projectId: string; count: number }[]>;
  /**
   * Tarefas e subtarefas não eliminadas (nem a tarefa principal, RN38) de uma equipa, ou as indicadas por
   * id, para o backlog e as sprints (I9). Quem chama exclui as de projetos eliminados.
   */
  planningTasks(query: TeamTaskQuery | { taskIds: string[] }, manager?: EntityManager): Promise<PlanningTaskInfo[]>;
  /** Quantas tarefas `planningTasks` devolveria para a equipa, sem a página (o total do backlog, D46). */
  countTeamTasks(query: TeamTaskFilter): Promise<number>;
  /** Contagens das tarefas da equipa numa só consulta, para a vista de trabalho (CA07.1, D46). */
  teamTaskCounts(query: TeamTaskFilter): Promise<TeamTaskCounts>;
  /** Projetos das tarefas não eliminadas da equipa, para quem chama excluir os eliminados (RN38). */
  projectsOfTeamTasks(teamId: string): Promise<string[]>;
  /**
   * Tarefas e subtarefas não eliminadas com o prazo já ultrapassado no dia indicado e não concluídas (RN29,
   * RN30; alertas de prazo, I11). Quem chama exclui as de projetos eliminados.
   */
  overdueTasks(today: string): Promise<{ id: string; teamId: string; projectId: string; assigneeId: string | null; dueDate: string }[]>;
}

/**
 * Tarefas de uma equipa, filtradas e paginadas na base de dados (backlog, D46): só dos projetos
 * indicados, sem as excluídas, mais recentes primeiro.
 */
export interface TeamTaskQuery {
  teamId: string;
  projectIds?: string[];
  excludeTaskIds?: string[];
  /** Só nestes estados; `blocked`/`overdue`: só as bloqueadas (RN28) ou as atrasadas (RF28). */
  states?: TaskState[];
  blocked?: true;
  overdue?: true;
  /** `attention`: bloqueadas, depois atrasadas, e dentro de cada grupo as mais recentes (CA07.4). */
  orderBy?: 'recent' | 'attention';
  limit?: number;
  offset?: number;
}

/** As condições de TeamTaskQuery, sem ordem nem página: o que as contagens aceitam. */
export type TeamTaskFilter = Omit<TeamTaskQuery, 'orderBy' | 'limit' | 'offset'>;

/** Contagens de `teamTaskCounts`: por estado, e as bloqueadas e as atrasadas de qualquer estado (CA07.1, CA07.4). */
export interface TeamTaskCounts {
  byState: Partial<Record<TaskState, number>>;
  blocked: number;
  overdue: number;
}

export const WORK_ITEM_LOCATOR = Symbol('WORK_ITEM_LOCATOR');
