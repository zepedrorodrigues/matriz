import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Palavra-passe das contas fictícias do realm local (MATRIZ_DEMO_PASSWORD, no .env; nunca no repositório). */
export const PASSWORD = process.env.MATRIZ_DEMO_PASSWORD;

/** Pré-requisitos com mensagens claras, para distinguir uma limitação do ambiente de um defeito. */
export async function requireEnvironment(request: APIRequestContext): Promise<void> {
  if (!PASSWORD) throw new Error('Falta MATRIZ_DEMO_PASSWORD (no .env local ou no ambiente).');
  const health = await request.get('/api/health').catch(() => null);
  if (!health?.ok()) throw new Error('A API não responde em /api/health: arranque o backend e o frontend (README › Desenvolvimento).');
}

/** Início de sessão real no Keycloak (Authorization Code + PKCE), como o utilizador o faz. */
export async function signIn(page: Page, username: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible();
  await page.getByLabel('Nome de utilizador ou e-mail').fill(username);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(PASSWORD!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Olá, / })).toBeVisible();
}

/** O token de acesso da sessão (a aplicação guarda-o no sessionStorage do separador, pelo oidc-client-ts). */
export async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:'));
    return key ? (JSON.parse(sessionStorage.getItem(key)!) as { access_token: string }).access_token : null;
  });
  if (!token) throw new Error('Sem sessão: o token de acesso não foi encontrado.');
  return token;
}
