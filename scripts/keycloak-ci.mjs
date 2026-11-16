// Prepara o Keycloak em contentor (serviço keycloak-setup do compose.yaml, DT19; usado também no CI):
// espera que o realm matriz responda e define a palavra-passe das contas fictícias pela API de
// administração — o mesmo que o scripts/keycloak-dev.ps1 faz em desenvolvimento, sem depender do Windows.
//
// O realm versionado não tem palavras-passe (SEC08). Os valores vêm só do ambiente e nunca são escritos:
//   KEYCLOAK_URL             endereço do Keycloak (por omissão http://localhost:8080)
//   KEYCLOAK_ADMIN_USER      administrador do realm master
//   KEYCLOAK_ADMIN_PASSWORD  palavra-passe desse administrador
//   MATRIZ_DEMO_PASSWORD     palavra-passe das contas fictícias do realm matriz
//   MATRIZ_PUBLIC_URL        opcional (DT21): endereço público da aplicação, p. ex. https://matriz.exemplo.
//                            Com ele, o cliente matriz-web passa a aceitar só esse endereço e o cliente
//                            matriz-dev-cli (utilizador e palavra-passe, só para desenvolvimento) é desativado.
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const base = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
const timeoutMs = Number(process.env.KEYCLOAK_START_TIMEOUT_SECONDS ?? 180) * 1000;

function setting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta a variável de ambiente ${name}.`);
  return value;
}

async function json(response, what) {
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status}`);
  return response.json();
}

const adminUser = setting('KEYCLOAK_ADMIN_USER');
const adminPassword = setting('KEYCLOAK_ADMIN_PASSWORD');
const demoPassword = setting('MATRIZ_DEMO_PASSWORD');
const realm = JSON.parse(readFileSync(new URL('../keycloak/realm-matriz.json', import.meta.url), 'utf8'));

// Espera que o realm matriz responda.
const deadline = Date.now() + timeoutMs;
for (;;) {
  const ready = await fetch(`${base}/realms/matriz/.well-known/openid-configuration`)
    .then((r) => r.ok)
    .catch(() => false);
  if (ready) break;
  if (Date.now() > deadline) throw new Error(`O Keycloak não respondeu em ${timeoutMs / 1000} s.`);
  await sleep(3000);
}

// Token de administração (no corpo do pedido, não na linha de comandos).
const { access_token: token } = await json(
  await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUser,
      password: adminPassword,
    }),
  }),
  'Token de administração',
);
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

for (const { username } of realm.users) {
  const found = await json(
    await fetch(`${base}/admin/realms/matriz/users?username=${encodeURIComponent(username)}&exact=true`, { headers }),
    `Procurar a conta ${username}`,
  );
  if (found.length === 0) throw new Error(`Conta ${username} não encontrada no realm matriz.`);
  const reset = await fetch(`${base}/admin/realms/matriz/users/${found[0].id}/reset-password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ type: 'password', value: demoPassword, temporary: false }),
  });
  if (!reset.ok) throw new Error(`Definir a palavra-passe da conta ${username}: HTTP ${reset.status}`);
}

console.log(`Keycloak pronto em ${base} (realm matriz). Palavra-passe definida para: ${realm.users.map((u) => u.username).join(', ')}.`);

// Ambiente público (DT21): o realm versionado só conhece http://localhost:5173.
const publicUrl = process.env.MATRIZ_PUBLIC_URL?.replace(/\/+$/, '');
if (publicUrl) {
  if (!/^https:\/\/[^/\s*]+$/.test(publicUrl)) {
    throw new Error('MATRIZ_PUBLIC_URL tem de ser uma origem https, sem caminho (p. ex. https://matriz.exemplo).');
  }

  async function updateClient(clientId, changes) {
    const found = await json(
      await fetch(`${base}/admin/realms/matriz/clients?clientId=${encodeURIComponent(clientId)}`, { headers }),
      `Procurar o cliente ${clientId}`,
    );
    if (found.length === 0) throw new Error(`Cliente ${clientId} não encontrado no realm matriz.`);
    const client = found[0];
    const updated = await fetch(`${base}/admin/realms/matriz/clients/${client.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...client, ...changes(client) }),
    });
    if (!updated.ok) throw new Error(`Atualizar o cliente ${clientId}: HTTP ${updated.status}`);
  }

  await updateClient('matriz-web', (client) => ({
    redirectUris: [`${publicUrl}/*`],
    webOrigins: [publicUrl],
    attributes: { ...client.attributes, 'post.logout.redirect.uris': `${publicUrl}/*` },
  }));
  await updateClient('matriz-dev-cli', () => ({ enabled: false }));
  console.log(`Cliente matriz-web limitado a ${publicUrl}; cliente matriz-dev-cli desativado.`);
}
