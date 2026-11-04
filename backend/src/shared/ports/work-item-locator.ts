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

/** Onde está uma tarefa e quem responde por ela — o necessário para avaliar a matriz de permissões. */
export interface TaskLocation {
  projectId: string;
  teamId: string;
  assigneeId: string | null;
  parentTaskId: string | null;
  state: TaskState;
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
}

export const WORK_ITEM_LOCATOR = Symbol('WORK_ITEM_LOCATOR');
