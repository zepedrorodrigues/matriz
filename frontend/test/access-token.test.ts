/**
 * Regressão do bug do I1 (Ficha PL 03, Ex. 8): depois de iniciar sessão, o primeiro `GET /me`
 * saía sem token porque o token só chegava ao cliente da API num efeito do React → 401 e mensagem
 * de sessão expirada. Agora o cliente lê o token do armazenamento do oidc-client-ts no momento do
 * pedido. Este teste usa a própria biblioteca para guardar a sessão, com o armazenamento por
 * omissão (sessionStorage), e confirma que o token é encontrado.
 *
 * Executar: npm test -w frontend (node:test do Node, sem dependências novas).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { User, UserManager } from 'oidc-client-ts';
import { readAccessToken, userStorageKey } from '../src/auth/access-token.ts';

class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.items.set(k, v);
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
  clear() {
    this.items.clear();
  }
}

const authority = 'http://localhost:8180/realms/matriz';
const clientId = 'matriz-web';

function newUser(accessToken: string) {
  const now = Math.floor(Date.now() / 1000);
  return new User({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_at: now + 300,
    profile: { sub: 'sub-1', iss: authority, aud: clientId, exp: now + 300, iat: now },
  });
}

test('I1 regressão — o token guardado pelo oidc-client-ts (armazenamento por omissão) é lido no momento do pedido', async () => {
  const storage = new MemoryStorage();
  // Como no browser: sem userStore explícito, o oidc-client-ts usa window.sessionStorage.
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  // O estado do pedido de início de sessão usa o localStorage (não é usado neste teste).
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  const manager = new UserManager({ authority, client_id: clientId, redirect_uri: 'http://localhost:5173/' });

  assert.equal(readAccessToken(storage, authority, clientId), undefined, 'sem sessão não há token');

  await manager.storeUser(newUser('token-de-teste'));
  assert.ok(storage.getItem(userStorageKey(authority, clientId)), 'a chave usada pela biblioteca é a esperada');
  assert.equal(readAccessToken(storage, authority, clientId), 'token-de-teste');

  await manager.removeUser();
  assert.equal(readAccessToken(storage, authority, clientId), undefined, 'depois de terminar a sessão não há token');
});

test('I1 — conteúdo inválido no armazenamento não rebenta o cliente da API', () => {
  const storage = new MemoryStorage();
  storage.setItem(userStorageKey(authority, clientId), '{isto não é json');
  assert.equal(readAccessToken(storage, authority, clientId), undefined);
});
