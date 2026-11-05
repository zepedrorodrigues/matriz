/**
 * Localização de uma sprint, implementada pelo módulo Planeamento (dono das tabelas) e usada pelo módulo
 * Identidade e acesso para aplicar a matriz de permissões (§3.1) sem ler as tabelas de outro módulo
 * (architecture.md §6).
 */
export interface SprintLocator {
  /** Equipa da sprint; null se a sprint não existir. */
  teamOfSprint(sprintId: string): Promise<string | null>;
}

export const SPRINT_LOCATOR = Symbol('SPRINT_LOCATOR');
