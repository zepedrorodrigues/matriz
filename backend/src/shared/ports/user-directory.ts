/**
 * Consulta de nomes de utilizadores para as respostas da API (UserSummary). Implementada pelo módulo
 * Identidade e acesso, dono dos utilizadores; os outros módulos dependem só desta interface
 * (architecture.md §6: nenhum módulo lê as tabelas de outro).
 */
export interface UserDirectory {
  /** Nome de cada utilizador encontrado, por id. */
  namesByIds(ids: string[]): Promise<Map<string, string>>;
}

export const USER_DIRECTORY = Symbol('USER_DIRECTORY');
