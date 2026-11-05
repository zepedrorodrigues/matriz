import type { EntityManager } from 'typeorm';

/**
 * Sobrecarga de uma sprint, implementada pelo módulo Planeamento (dono da capacidade) e usada pelo módulo
 * Acompanhamento para os alertas de sobrecarga (CA05.8, RN19; I11). Lê na transação indicada, para incluir
 * as alterações ainda por confirmar (os alertas criam-se na mesma transação do evento, DT07).
 */
export interface CapacityReader {
  /** Equipa, sobrecarga da equipa e membros em sobrecarga; `null` numa sprint terminada ou inexistente. */
  overloadState(sprintId: string, manager: EntityManager): Promise<{ teamId: string; team: boolean; users: string[] } | null>;
  /** Sprints «Planeada» ou «Ativa» de que a tarefa faz parte (ou em que está planeada). */
  openSprintsOfTask(taskId: string, manager: EntityManager): Promise<string[]>;
}

export const CAPACITY_READER = Symbol('CAPACITY_READER');
