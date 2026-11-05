import type { EntityManager } from 'typeorm';

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
  createdAt: string;
}

/** Onde está uma tarefa e quem responde por ela — o necessário para avaliar a matriz de permissões. */
export interface TaskLocation {
  projectId: string;
  teamId: string;
  assigneeId: string | null;
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
  openTaskCountsOfTeam(teamId: string): Promise<{ projectId: string; count: number }[]>;
  /**
   * Tarefas e subtarefas não eliminadas (nem a tarefa principal, RN38) de uma equipa, ou as indicadas por
   * id, para o backlog e as sprints (I9). Quem chama exclui as de projetos eliminados.
   */
  planningTasks(query: { teamId: string } | { taskIds: string[] }, manager?: EntityManager): Promise<PlanningTaskInfo[]>;
  /**
   * Tarefas e subtarefas não eliminadas com o prazo já ultrapassado no dia indicado e não concluídas (RN29,
   * RN30; alertas de prazo, I11). Quem chama exclui as de projetos eliminados.
   */
  overdueTasks(today: string): Promise<{ id: string; teamId: string; projectId: string; assigneeId: string | null; dueDate: string }[]>;
}

export const WORK_ITEM_LOCATOR = Symbol('WORK_ITEM_LOCATOR');
