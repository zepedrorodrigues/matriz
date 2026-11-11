import type { EntityManager } from 'typeorm';

/**
 * Consulta de nomes de utilizadores para as respostas da API (UserSummary). Implementada pelo módulo
 * Identidade e acesso, dono dos utilizadores; os outros módulos dependem só desta interface
 * (architecture.md §6: nenhum módulo lê as tabelas de outro).
 */
export interface UserDirectory {
  /** Nome de cada utilizador encontrado, por id. */
  namesByIds(ids: string[], manager?: EntityManager): Promise<Map<string, string>>;
  /**
   * Utilizadores ativos, ordenados pelo nome: os indicados ou, sem `ids`, todos (utilizadores
   * elegíveis, RN03, RN40). Um utilizador desativado nunca é elegível.
   */
  activeUsers(ids?: string[]): Promise<{ id: string; name: string }[]>;
  /** Tem o papel global de administrador (§3.1). */
  isAdmin(userId: string, manager?: EntityManager): Promise<boolean>;
}

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');
