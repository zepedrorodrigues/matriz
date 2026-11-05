import type { EntityManager } from 'typeorm';

/**
 * Localização de uma sprint, implementada pelo módulo Planeamento (dono das tabelas) e usada pelo módulo
 * Identidade e acesso para aplicar a matriz de permissões (§3.1) sem ler as tabelas de outro módulo
 * (architecture.md §6). Usada também pelo módulo Trabalho na transferência de tarefas (RN20, I12).
 */
export interface SprintLocator {
  /** Equipa da sprint; null se a sprint não existir. */
  teamOfSprint(sprintId: string): Promise<string | null>;
  /**
   * RN20, CA09.8: retira das sprints em aberto as tarefas transferidas para outra equipa, na transação de
   * quem transfere. Devolve, por tarefa, a sprint de que saiu.
   */
  releaseTransferredTasks(taskIds: string[], authorId: string, manager: EntityManager): Promise<Map<string, string>>;
}

export const SPRINT_LOCATOR = Symbol('SPRINT_LOCATOR');
