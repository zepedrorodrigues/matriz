/**
 * Indicação de que a sessão deixou de ser válida, mostrada no ecrã de início de sessão
 * (Ficha PL 03, Ex. 3). Guardada no sessionStorage para sobreviver ao fim da sessão OIDC;
 * se o armazenamento não estiver disponível, a mensagem perde-se mas a aplicação funciona.
 */
const KEY = 'matriz.sessionExpired';

export function markSessionExpired(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* armazenamento indisponível */
  }
}

export function consumeSessionExpired(): boolean {
  try {
    const expired = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return expired;
  } catch {
    return false;
  }
}
