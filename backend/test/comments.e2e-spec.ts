import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I7 — Comentários (Ficha PL 03, Ex. 6): US10 CA10.1–CA10.5; RN41, RF35, CAT06, RN38. Decisão do humano
 * de 2026-11-05 (F16): num comentário, os outros campos enviados (autor, data) são ignorados (CA10.5).
 */
describe('I7 — comentários', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  type Role = 'admin' | 'leaderA' | 'memberA' | 'leaderB' | 'outsider';
  const users = {} as Record<Role, U>;
  const tokens = {} as Record<Role, string>;
  let teamA: string;
  let epicId: string;

  const api = (role: Role) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[role]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object) => auth(request(t.server).post(url)).send(body),
    };
  };
  const commentsUrl = (taskId: string) => `/api/tasks/${taskId}/comments`;
  const commentRows = (taskId: string) =>
    t.db.query(`SELECT author_id, body, created_at FROM work.comment WHERE task_id = $1 ORDER BY created_at, id`, [taskId]);
  const newTask = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) =>
    fx.task({ epicId, teamId: teamA, createdBy: users.leaderA.id, ...opts });

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    users.admin = await fx.user('Admin', { isAdmin: true });
    users.leaderA = await fx.user('Lider A');
    users.memberA = await fx.user('Membro A');
    users.leaderB = await fx.user('Lider B');
    users.outsider = await fx.user('Fora');
    teamA = await fx.team('Equipa A', [
      { userId: users.leaderA.id, role: 'leader' },
      { userId: users.memberA.id, role: 'member' },
    ]);
    const teamB = await fx.team('Equipa B', [{ userId: users.leaderB.id, role: 'leader' }]);
    const teamC = await fx.team('Equipa C', [{ userId: users.outsider.id, role: 'leader' }]);
    const projectId = await fx.project('Projeto dos comentários', { teams: [teamA, teamB] });
    await fx.project('Outro projeto', { teams: [teamC] });
    epicId = await fx.epic(await fx.objective(projectId));
    for (const role of Object.keys(users) as Role[]) tokens[role] = await t.token({ email: users[role].email });
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA10.1, RN41 — quem vê o projeto comenta: o comentário fica guardado com o seu nome e a data/hora do sistema', async () => {
    const taskId = await newTask();
    const before = Date.now();
    const res = await api('memberA').post(commentsUrl(taskId), { body: '  Falta validar no Safari.  ' }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      taskId,
      author: { id: users.memberA.id, name: 'Membro A' },
      body: 'Falta validar no Safari.',
      createdAt: expect.any(String),
    });
    expect(Math.abs(new Date(res.body.createdAt).getTime() - before)).toBeLessThan(60_000);
    // Também quem não é da equipa responsável, mas vê o projeto (outra equipa do projeto, administrador).
    await api('leaderB').post(commentsUrl(taskId), { body: 'Da equipa B' }).expect(201);
    await api('admin').post(commentsUrl(taskId), { body: 'Do administrador' }).expect(201);
    expect((await commentRows(taskId)).map((r: { author_id: string }) => r.author_id)).toEqual([
      users.memberA.id,
      users.leaderB.id,
      users.admin.id,
    ]);
  });

  it('CA10.2, D46 — os comentários aparecem por ordem cronológica, paginados, com o total de todos os comentários', async () => {
    const taskId = await newTask();
    for (const body of ['primeiro', 'segundo', 'terceiro']) {
      await api('leaderA').post(commentsUrl(taskId), { body }).expect(201);
    }
    const all = await api('memberA').get(commentsUrl(taskId)).expect(200);
    expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 3 });
    expect(all.body.items.map((c: { body: string }) => c.body)).toEqual(['primeiro', 'segundo', 'terceiro']);
    expect(all.body.items[0]).toMatchObject({ author: { id: users.leaderA.id, name: 'Lider A' }, createdAt: expect.any(String) });
    const page2 = await api('memberA').get(`${commentsUrl(taskId)}?page=2&pageSize=2`).expect(200);
    expect(page2.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page2.body.items.map((c: { body: string }) => c.body)).toEqual(['terceiro']);
    await api('memberA').get(`${commentsUrl(taskId)}?pageSize=101`).expect(400);
    await api('memberA').get(`${commentsUrl(taskId)}?page=0`).expect(400);
  });

  it('CA10.2, Ex. 6 — os comentários mantêm-se depois de reabrir uma tarefa entregue (RN26)', async () => {
    const taskId = await newTask({ state: 'delivered' });
    await api('memberA').post(commentsUrl(taskId), { body: 'Antes de reabrir' }).expect(201);
    await api('leaderA').post(`/api/tasks/${taskId}/state`, { state: 'in_development' }).expect(200);
    await api('memberA').post(commentsUrl(taskId), { body: 'Depois de reabrir' }).expect(201);
    const res = await api('leaderB').get(commentsUrl(taskId)).expect(200);
    expect(res.body.items.map((c: { body: string }) => c.body)).toEqual(['Antes de reabrir', 'Depois de reabrir']);
  });

  it('CA10.3, RN41 — vazio, só com espaços, com mais de 2000 caracteres ou sem texto é recusado (400) e nada é guardado', async () => {
    const taskId = await newTask();
    for (const body of ['', '    ', '\n\t ', 'x'.repeat(2001), `  ${'y'.repeat(2001)}  `]) {
      const res = await api('memberA').post(commentsUrl(taskId), { body }).expect(400);
      expect(res.body.errors[0].field).toBe('body');
    }
    await api('memberA').post(commentsUrl(taskId), {}).expect(400);
    await api('memberA').post(commentsUrl(taskId), { body: 42 }).expect(400);
    expect(await commentRows(taskId)).toEqual([]);
    // Limites: 1 e 2000 caracteres, contados depois de retirar os espaços no início e no fim.
    await api('memberA').post(commentsUrl(taskId), { body: 'k' }).expect(201);
    await api('memberA').post(commentsUrl(taskId), { body: `   ${'z'.repeat(2000)}   ` }).expect(201);
    expect((await commentRows(taskId)).map((r: { body: string }) => r.body.length)).toEqual([1, 2000]);
  });

  it('CA10.4, CAT06 — quem não vê o projeto não comenta nem consulta (403, nada guardado)', async () => {
    const taskId = await newTask();
    await api('leaderA').post(commentsUrl(taskId), { body: 'Existe' }).expect(201);
    await api('outsider').post(commentsUrl(taskId), { body: 'Sem acesso' }).expect(403);
    await api('outsider').get(commentsUrl(taskId)).expect(403);
    expect(await commentRows(taskId)).toHaveLength(1);
  });

  it('CA10.5 (F16) — um autor ou uma data indicados no pedido são ignorados: autor do token, data do sistema', async () => {
    const taskId = await newTask();
    const res = await api('memberA')
      .post(commentsUrl(taskId), { body: 'Comentário', authorId: users.admin.id, author: { id: users.admin.id }, createdAt: '2000-01-01T00:00:00Z' })
      .expect(201);
    expect(res.body.author.id).toBe(users.memberA.id);
    expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2000);
    const [row] = await commentRows(taskId);
    expect(row.author_id).toBe(users.memberA.id);
  });

  it('RN38 — numa tarefa eliminada ou inexistente, os comentários respondem 404', async () => {
    const taskId = await newTask();
    await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [taskId]);
    await api('leaderA').get(commentsUrl(taskId)).expect(404);
    await api('leaderA').post(commentsUrl(taskId), { body: 'Eliminada' }).expect(404);
    await api('leaderA').post(commentsUrl('00000000-0000-4000-8000-000000000000'), { body: 'Inexistente' }).expect(404);
    expect(await commentRows(taskId)).toEqual([]);
  });
});
