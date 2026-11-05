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
  locateTask(taskId: string): Promise<TaskLocation | null>;
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
  planningTasks(query: { teamId: string } | { taskIds: string[] }): Promise<PlanningTaskInfo[]>;
}

export const WORK_ITEM_LOCATOR = Symbol('WORK_ITEM_LOCATOR');
