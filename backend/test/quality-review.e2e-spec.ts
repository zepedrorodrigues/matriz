import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * Ficha PL 04, Ex. 5.4 — regressões das correções da revisão de código e de segurança
 * (docs/quality-security-review.md). Decisões do humano (F24): 1a — só a atribuição por exceção (RN03) dá ao
 * responsável de outra equipa acesso à tarefa, e quem sai da equipa deixa de o ter; 2a — esse responsável só
 * atualiza o estado, os critérios e os bloqueios e comenta.
 */
describe('Ficha 04 — correções da revisão de código e de segurança', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, projectId: string, epicId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
    };
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, estimateHours: 4, ...opts });
  const row = async (id: string) =>
    (await t.db.query(`SELECT title, description, estimate_hours, assignee_id, assignee_cross_team, is_blocked FROM work.task WHERE id = $1`, [id]))[0];
  const assignOutsider = (id: string) =>
    as('manager').patch(`/api/tasks/${id}`, { assigneeId: ids.outsider, assignmentJustification: 'Especialista da equipa Fora' }).expect(200);

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, adminMember: { isAdmin: true }, manager: {}, leaderA: {}, memberA: {}, leaving: {}, outsider: {} })) {
      const u = await fx.user(k, opts);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
      { userId: ids.leaving, role: 'member' },
      { userId: ids.adminMember, role: 'member' },
    ]);
    await fx.team('Fora', [{ userId: ids.outsider, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA] });
    epicId = await fx.epic(await fx.objective(projectId));
  });

  afterAll(async () => {
    await t.close();
  });

  it('S1, RN03 (decisão 1a) — quem sai da equipa deixa de ver e de trabalhar nas tarefas que lhe continuam atribuídas', async () => {
    const id = await task({ state: 'in_development', assigneeId: ids.leaving });
    await as('leaving').get(`/api/tasks/${id}`).expect(200);
    await as('admin').put(`/api/users/${ids.leaving}/memberships`, { memberships: [] }).expect(200);
    await as('leaving').get(`/api/tasks/${id}`).expect(403);
    await as('leaving').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'Já não sou da equipa' }).expect(403);
    await as('leaving').post(`/api/tasks/${id}/state`, { state: 'in_testing' }).expect(403);
    // A atribuição mantém-se (RN15): o líder vê quem a tinha e atribui de novo.
    expect(await row(id)).toMatchObject({ assignee_id: ids.leaving, assignee_cross_team: false, is_blocked: false });
  });

  it('S2, F23 (decisão 2a) — o responsável de outra equipa atualiza o estado, os critérios e os bloqueios e comenta; não edita nem lista os membros', async () => {
    const id = await task({ state: 'in_development', title: 'Título original' });
    await t.db.query(`UPDATE work.task SET description = 'Descrição original' WHERE id = $1`, [id]);
    const criterion = await fx.criterion(id, ids.leaderA);
    await assignOutsider(id);
    expect((await row(id)).assignee_cross_team).toBe(true);
    for (const body of [{ title: 'Reescrito de fora' }, { description: 'Reescrita de fora' }, { estimateHours: 99 }, { storyPoints: 8 }, { priority: 'high' }, { dueDate: '2032-01-01' }]) {
      const res = await as('outsider').patch(`/api/tasks/${id}`, body).expect(403);
      expect(res.body.detail).toContain('responsável de outra equipa');
    }
    await as('outsider').get(`/api/tasks/${id}/eligible-users`).expect(403);
    expect(await row(id)).toMatchObject({ title: 'Título original', description: 'Descrição original', estimate_hours: '4.00' });
    await as('outsider').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'À espera do acesso' }).expect(200);
    await as('outsider').patch(`/api/tasks/${id}/acceptance-criteria/${criterion}`, { isMet: true }).expect(200);
    await as('outsider').post(`/api/tasks/${id}/state`, { state: 'in_testing' }).expect(200);
    await as('outsider').post(`/api/tasks/${id}/comments`, { body: 'Em testes.' }).expect(201);
    // Atribuir a alguém da equipa apaga a marca da exceção; o de fora deixa de ver a tarefa.
    await as('leaderA').patch(`/api/tasks/${id}`, { assigneeId: ids.memberA }).expect(200);
    expect(await row(id)).toMatchObject({ assignee_id: ids.memberA, assignee_cross_team: false });
    await as('outsider').get(`/api/tasks/${id}`).expect(403);
  });

  it('S3, CAT06 — um alerta de uma tarefa que o destinatário deixou de ver mantém-se, mas sem os dados da tarefa', async () => {
    const id = await task({ state: 'delivered', title: 'Título que não deve sair' });
    await assignOutsider(id);
    await as('manager').post(`/api/tasks/${id}/state`, { state: 'in_development' }).expect(200);
    const mine = async () =>
      ((await as('outsider').get('/api/alerts?pageSize=100').expect(200)).body.items as { type: string; task: { id: string; title: string } | null }[]).filter(
        (a) => a.type === 'task_reopened',
      );
    // Enquanto a vê, o alerta mostra a tarefa.
    expect((await mine()).find((a) => a.task?.id === id)?.task?.title).toBe('Título que não deve sair');
    await as('manager').patch(`/api/tasks/${id}`, { assigneeId: null }).expect(200);
    const after = await as('outsider').get('/api/alerts?pageSize=100').expect(200);
    expect(JSON.stringify(after.body)).not.toContain('Título que não deve sair');
    expect((await mine()).some((a) => a.task === null)).toBe(true);
  });

  it('S5, D46 — página acima do máximo → 400 (antes: 500 por excesso no OFFSET); a página máxima é aceite', async () => {
    const id = await task();
    for (const [who, url] of [
      ['manager', '/api/projects'],
      ['manager', `/api/projects/${projectId}/tasks`],
      ['manager', `/api/tasks/${id}/comments`],
      ['manager', '/api/alerts'],
      ['admin', '/api/users'],
      ['leaderA', `/api/teams/${teamA}/backlog`],
      ['leaderA', `/api/teams/${teamA}/work`],
    ] as const) {
      await as(who).get(`${url}?page=1e21`).expect(400);
      await as(who).get(`${url}?page=100001`).expect(400);
      await as(who).get(`${url}?page=100000`).expect(200);
    }
  });

  it('CR1 — planear com uma transferência em curso não entra em deadlock: a sprint fica livre enquanto o planeamento espera pela tarefa', async () => {
    const id = await task({ title: 'Já na sprint' });
    const [{ id: sprintId }] = await t.db.query(
      `INSERT INTO planning.sprint (team_id, start_date, end_date) VALUES ($1, '2034-01-02', '2034-01-13') RETURNING id`,
      [teamA],
    );
    await t.db.query(`INSERT INTO planning.sprint_task (sprint_id, task_id) VALUES ($1, $2)`, [sprintId, id]);
    const runner = t.db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      // Como a transferência: primeiro a tarefa, depois a sprint em que está.
      await runner.query(`SELECT id FROM work.task WHERE id = $1 FOR UPDATE`, [id]);
      const pending = as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: id }).then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 600));
      // Com a ordem antiga, o planeamento já teria a sprint e isto esperava por ele: deadlock (500).
      await runner.query(`SET LOCAL lock_timeout = '3s'`);
      await runner.query(`SELECT id FROM planning.sprint WHERE id = $1 FOR UPDATE`, [sprintId]);
      await runner.commitTransaction();
      const res = await pending;
      expect(res.status).toBe(409);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('CR5, RN09 — o administrador que também é membro da equipa cria como administrador: sem alerta aos líderes', async () => {
    const created = await as('adminMember').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do administrador-membro' }).expect(201);
    const alerts = (await as('leaderA').get('/api/alerts?pageSize=100').expect(200)).body.items as { type: string; task: { id: string } | null }[];
    expect(alerts.filter((a) => a.type === 'member_task_created' && a.task?.id === created.body.id)).toEqual([]);
  });
});
