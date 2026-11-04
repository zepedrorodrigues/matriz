import { User } from 'oidc-client-ts';

/**
 * Chave em que o oidc-client-ts guarda a sessão por omissão (WebStorageStateStore, prefixo `oidc.`).
 * Confirmada pelo teste test/access-token.test.ts contra a própria biblioteca.
 */
export function userStorageKey(authority: string, clientId: string): string {
  return `oidc.user:${authority}:${clientId}`;
}

/**
 * Token de acesso da sessão atual, lido do armazenamento no momento de cada pedido.
 * Não depende da ordem dos efeitos do React: o primeiro pedido feito logo após o regresso do
 * Keycloak já leva o token (correção do bug do I1: `GET /me` enviado sem token → 401).
 */
export function readAccessToken(storage: Pick<Storage, 'getItem'>, authority: string, clientId: string): string | undefined {
  try {
    const raw = storage.getItem(userStorageKey(authority, clientId));
    return raw ? User.fromStorageString(raw).access_token : undefined;
  } catch {
    return undefined;
  }
}
