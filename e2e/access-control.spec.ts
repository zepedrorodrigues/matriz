import { expect, test, type APIRequestContext } from '@playwright/test';
import { accessToken, requireEnvironment, signIn } from './support';

/**
 * Ficha PL 04, Ex. 5.2 — autorização entre dois utilizadores de demonstração (IDOR / Broken Access Control;
 * CAT06, §3.1; docs/test-plan.md P-03, docs/quality-security-review.md §3).
 *
 * `bruno` (líder da Equipa Beta) vê o projeto «Arquivo Digital» e as suas tarefas; `rui` (membro da Equipa
 * Alfa) não. Com as duas sessões reais do Keycloak, em contextos de browser separados, o Rui usa os
 * identificadores do Bruno — mudando o id no pedido, como num ataque IDOR — pela API e pela interface. Nada
 * é alterado: todos os pedidos do Rui têm de ser recusados, e o Bruno confirma no fim que a tarefa ficou igual.
 */
const OWNER = process.env.E2E_OWNER ?? 'bruno';
const OTHER = process.env.E2E_OTHER ?? 'rui';
const PROJECT = process.env.E2E_OWNER_PROJECT ?? 'Arquivo Digital';

const as = (request: APIRequestContext, token: string) => {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request.get(url, { headers }),
    patch: (url: string, data: object) => request.patch(url, { headers, data }),
    post: (url: string, data: object) => request.post(url, { headers, data }),
    delete: (url: string) => request.delete(url, { headers }),
  };
};

test.beforeAll(async ({ request }) => {
  await requireEnvironment(request);
});

test('SEC-01 — o Rui não consulta nem altera o projeto e a tarefa do Bruno, mesmo com os ids certos (403)', async ({ browser, request }) => {
  // Sessão do dono dos recursos: obtém os ids pela API, como o próprio os vê.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, OWNER);
  const owner = as(request, await accessToken(ownerPage));
  const projects = await (await owner.get(`/api/projects?q=${encodeURIComponent(PROJECT)}`)).json();
  const projectId: string = projects.items.find((p: { name: string }) => p.name === PROJECT)?.id;
  expect(projectId, `o ${OWNER} vê o projeto ${PROJECT}`).toBeTruthy();
  const tasks = await (await owner.get(`/api/projects/${projectId}/tasks?pageSize=1`)).json();
  const taskId: string = tasks.items[0]?.id;
  expect(taskId, `o projeto ${PROJECT} tem tarefas`).toBeTruthy();
  const before = await (await owner.get(`/api/tasks/${taskId}`)).json();

  // Sessão do outro utilizador, noutro contexto (outro «browser»).
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signIn(otherPage, OTHER);
  const other = as(request, await accessToken(otherPage));

  // Não aparece nas listagens nem nas pesquisas dele…
  const visible = await (await other.get(`/api/projects?q=${encodeURIComponent(PROJECT)}`)).json();
  expect(visible.items.map((p: { id: string }) => p.id)).not.toContain(projectId);

  // …e, com os ids do Bruno, cada operação é recusada (403), sem revelar os dados.
  const attempts = [
    ['GET projeto', await other.get(`/api/projects/${projectId}`)],
    ['PATCH projeto', await other.patch(`/api/projects/${projectId}`, { name: 'Alterado por outro utilizador' })],
    ['DELETE projeto', await other.delete(`/api/projects/${projectId}`)],
    ['GET tarefas do projeto', await other.get(`/api/projects/${projectId}/tasks`)],
    ['POST tarefa no projeto', await other.post(`/api/projects/${projectId}/tasks`, { title: 'Criada por outro', epicId: before.epicId, teamId: before.teamId })],
    ['GET tarefa', await other.get(`/api/tasks/${taskId}`)],
    ['PATCH tarefa', await other.patch(`/api/tasks/${taskId}`, { title: 'Alterada por outro utilizador' })],
    ['POST estado', await other.post(`/api/tasks/${taskId}/state`, { state: 'in_technical_analysis' })],
    ['DELETE tarefa', await other.delete(`/api/tasks/${taskId}`)],
    ['GET comentários', await other.get(`/api/tasks/${taskId}/comments`)],
    ['POST comentário', await other.post(`/api/tasks/${taskId}/comments`, { body: 'Comentário de outro utilizador' })],
    ['GET participantes', await other.get(`/api/tasks/${taskId}/participants`)],
  ] as const;
  for (const [label, res] of attempts) {
    expect(res.status(), label).toBe(403);
    expect(JSON.stringify(await res.json()), `${label} não devolve dados da tarefa`).not.toContain(before.title);
  }

  // Pela interface: o endereço direto da tarefa e do projeto mostra a recusa.
  await otherPage.goto(`/tarefas/${taskId}`);
  await expect(otherPage.getByText('Não tem acesso a esta tarefa.')).toBeVisible();
  await expect(otherPage.getByText(before.title)).toHaveCount(0);
  await otherPage.goto(`/projetos/${projectId}`);
  await expect(otherPage.getByText('Não tem acesso a este projeto.')).toBeVisible();

  // O dono confirma que nada mudou.
  const after = await (await owner.get(`/api/tasks/${taskId}`)).json();
  expect({ title: after.title, state: after.state, deleted: false }).toEqual({ title: before.title, state: before.state, deleted: false });
  expect((await owner.get(`/api/projects/${projectId}`)).status()).toBe(200);

  await ownerContext.close();
  await otherContext.close();
});
