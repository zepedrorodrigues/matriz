import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I11, passo 1 — Acompanhamento: US07 CA07.1–CA07.4, CA07.6; RN10, RN28, RN29, RN37; RF26–RF29; SEC06;
 * §3.1. Decisão do humano (F21): quem cria indica o prazo; depois alteram-no o líder, o gestor e o
 * administrador.
 */
describe('I11 — acompanhamento (prazos, bloqueios, trabalho da equipa, comparação da sprint)', () => {
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
    };
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, ...opts });
  const row = async (id: string) =>
    (await t.db.query(`SELECT to_char(due_date, 'YYYY-MM-DD') AS due, is_blocked, block_reason, state FROM work.task WHERE id = $1`, [id]))[0];
  const history = (id: string) => t.db.query(`SELECT event_type, old_value, new_value FROM history.history_event WHERE entity_id = $1 ORDER BY id`, [id]);
  const lisbonToday = async () =>
    (await t.db.query(`SELECT to_char((now() AT TIME ZONE 'Europe/Lisbon')::date, 'YYYY-MM-DD') AS d`))[0].d as string;
  const shift = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, manager: {}, leaderA: {}, memberA: {}, memberA2: {}, outsider: {} })) {
      const u = await fx.user(k, opts);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
      { userId: ids.memberA2, role: 'member' },
    ]);
    await fx.team('Fora', [{ userId: ids.outsider, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA] });
    epicId = await fx.epic(await fx.objective(projectId));
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Prazos (RN29, F21)', () => {
    it('RN29 — quem cria (um membro) indica o prazo; depois só o líder, o gestor e o administrador o alteram (due_date_changed); null retira-o', async () => {
      const created = await as('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Com prazo', dueDate: '2031-03-15' }).expect(201);
      expect(created.body.dueDate).toBe('2031-03-15');
      const id = created.body.id;
      await as('memberA').patch(`/api/tasks/${id}`, { dueDate: '2031-04-01' }).expect(403);
      expect((await row(id)).due).toBe('2031-03-15');
      await as('leaderA').patch(`/api/tasks/${id}`, { dueDate: '2031-04-01' }).expect(200);
      await as('manager').patch(`/api/tasks/${id}`, { dueDate: '2031-04-02' }).expect(200);
      await as('admin').patch(`/api/tasks/${id}`, { dueDate: null }).expect(200);
      expect((await row(id)).due).toBeNull();
      expect((await history(id)).filter((e: { event_type: string }) => e.event_type === 'due_date_changed').map((e: { new_value: unknown }) => e.new_value)).toEqual([
        { dueDate: '2031-04-01' },
        { dueDate: '2031-04-02' },
        { dueDate: null },
      ]);
      await as('leaderA').patch(`/api/tasks/${id}`, { dueDate: '2031-02-30' }).expect(400);
      await as('leaderA').patch(`/api/tasks/${id}`, { dueDate: '15/03/2031' }).expect(400);
    });

    it('CA07.3, RF28 — com o prazo ultrapassado (no fuso da aplicação) e não concluída, a tarefa é atrasada; concluída ou com prazo futuro, não', async () => {
      const today = await lisbonToday();
      const late = await task({ title: 'Atrasada' });
      const doneLate = await task({ title: 'Concluída', state: 'done' });
      const dueToday = await task({ title: 'Hoje' });
      await t.db.query(`UPDATE work.task SET due_date = $2 WHERE id = ANY($1::uuid[])`, [[late, doneLate], shift(today, -1)]);
      await t.db.query(`UPDATE work.task SET due_date = $2 WHERE id = $1`, [dueToday, today]);
      expect((await as('memberA').get(`/api/tasks/${late}`).expect(200)).body).toMatchObject({ isOverdue: true, dueDate: shift(today, -1) });
      expect((await as('memberA').get(`/api/tasks/${doneLate}`).expect(200)).body.isOverdue).toBe(false);
      expect((await as('memberA').get(`/api/tasks/${dueToday}`).expect(200)).body.isOverdue).toBe(false);
      const list = await as('memberA').get(`/api/projects/${projectId}/tasks?pageSize=100`).expect(200);
      expect(list.body.items.find((i: { id: string }) => i.id === late).isOverdue).toBe(true);
      // A vista da equipa usa a mesma regra: o próprio dia do prazo ainda não é atraso.
      const overdue = await as('memberA').get(`/api/teams/${teamA}/work?group=overdue&pageSize=100`).expect(200);
      const overdueIds = overdue.body.items.map((i: { id: string }) => i.id);
      expect(overdueIds).toContain(late);
      expect(overdueIds).not.toContain(dueToday);
      expect(overdueIds).not.toContain(doneLate);
    });
  });

  describe('Bloqueios (RN28, CA07.6)', () => {
    it('CA07.6 — o membro bloqueia a tarefa que lhe está atribuída, com o motivo: o estado mantém-se; desbloquear apaga o motivo; tudo no histórico', async () => {
      const id = await task({ assigneeId: ids.memberA, state: 'in_development' });
      const res = await as('memberA').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: '  À espera do acesso à API de pagamentos  ' }).expect(200);
      expect(res.body).toMatchObject({ isBlocked: true, blockReason: 'À espera do acesso à API de pagamentos', state: 'in_development' });
      await as('memberA').patch(`/api/tasks/${id}`, { blockReason: 'Acesso pedido; sem resposta' }).expect(200);
      await as('memberA').patch(`/api/tasks/${id}`, { isBlocked: false }).expect(200);
      expect(await row(id)).toMatchObject({ is_blocked: false, block_reason: null, state: 'in_development' });
      expect((await history(id)).map((e: { event_type: string }) => e.event_type)).toEqual(['blocked', 'block_reason_changed', 'unblocked']);
    });

    it('RN28, SEC06 — bloquear sem motivo ou só com espaços → 422; motivo sem bloqueio → 422; mais de 2000 caracteres → 400; nada muda', async () => {
      const id = await task({ assigneeId: ids.memberA });
      await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: true }).expect(422);
      await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: '   ' }).expect(422);
      await as('leaderA').patch(`/api/tasks/${id}`, { blockReason: 'Sem bloquear' }).expect(422);
      await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'x'.repeat(2001) }).expect(400);
      await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: 'sim', blockReason: 'x' }).expect(400);
      expect(await row(id)).toMatchObject({ is_blocked: false, block_reason: null });
      expect(await history(id)).toEqual([]);
    });

    it('§3.1 — o membro não bloqueia tarefas que não lhe estão atribuídas (403); o líder, o gestor e o administrador bloqueiam qualquer uma', async () => {
      const id = await task({ assigneeId: ids.memberA });
      await as('memberA2').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'x' }).expect(403);
      await as('outsider').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'x' }).expect(403);
      expect((await row(id)).is_blocked).toBe(false);
      for (const who of ['leaderA', 'manager', 'admin']) {
        await as(who).patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: `Bloqueio de ${who}` }).expect(200);
        await as(who).patch(`/api/tasks/${id}`, { isBlocked: false }).expect(200);
      }
    });
  });

  describe('Trabalho da equipa (CA07.1, CA07.4)', () => {
    it('CA07.1, CA07.3, CA07.4 — planeadas, em execução e concluídas, e as bloqueadas (com o motivo) e atrasadas, qualquer que seja o estado; contagens do conjunto completo', async () => {
      const team = await fx.team('Equipa da vista', [
        { userId: ids.leaderA, role: 'leader' },
        { userId: ids.memberA, role: 'member' },
      ]);
      await t.db.query(`INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)`, [projectId, team]);
      const make = (state: string) => fx.task({ epicId, teamId: team, createdBy: ids.leaderA, state });
      await make('in_planning');
      await make('ready_for_development');
      const testing = await make('in_testing');
      await make('done');
      const delivered = await make('delivered');
      await t.db.query(`UPDATE work.task SET is_blocked = true, block_reason = 'Ambiente de testes em baixo' WHERE id = $1`, [testing]);
      await t.db.query(`UPDATE work.task SET due_date = '2020-01-01' WHERE id = $1`, [testing]);
      await t.db.query(`UPDATE work.task SET due_date = '2020-01-01' WHERE id = $1`, [delivered]);
      const gone = await make('in_planning');
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [gone]);

      const res = await as('memberA').get(`/api/teams/${team}/work?pageSize=2`).expect(200);
      expect(res.body.counts).toEqual({ planned: 2, in_progress: 1, done: 2, blocked: 1, overdue: 1 });
      expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(res.body.items[0]).toMatchObject({ id: testing, isBlocked: true, blockReason: 'Ambiente de testes em baixo', isOverdue: true, state: 'in_testing', projectName: 'Projeto' });
      const blocked = await as('leaderA').get(`/api/teams/${team}/work?group=blocked`).expect(200);
      expect(blocked.body.items.map((i: { id: string }) => i.id)).toEqual([testing]);
      expect(blocked.body.counts.planned).toBe(2);
      const done = await as('leaderA').get(`/api/teams/${team}/work?group=done`).expect(200);
      expect(done.body.total).toBe(2);
      await as('leaderA').get(`/api/teams/${team}/work?group=todas`).expect(400);
      // Quem consulta: membros, administrador e gestores dos projetos da equipa (F20).
      await as('manager').get(`/api/teams/${team}/work`).expect(200);
      await as('admin').get(`/api/teams/${team}/work`).expect(200);
      await as('outsider').get(`/api/teams/${team}/work`).expect(403);
    });

    it('CA07.1, CA07.4, D46, RN38 — paginada na base de dados: bloqueadas, depois atrasadas, depois as mais recentes, com páginas seguidas sem repetir nem saltar (dados parados); projetos eliminados fora das contagens', async () => {
      const team = await fx.team('Equipa paginada', [{ userId: ids.leaderA, role: 'leader' }]);
      await t.db.query(`INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)`, [projectId, team]);
      const make = (state: string, epic = epicId) => fx.task({ epicId: epic, teamId: team, createdBy: ids.leaderA, state });
      const set = (id: string, sql: string) => t.db.query(`UPDATE work.task SET ${sql} WHERE id = $1`, [id]);
      const blockedOld = await make('in_planning');
      await set(blockedOld, `is_blocked = true, block_reason = 'Antiga'`);
      const late = await make('in_development');
      await set(late, `due_date = '2020-01-01'`);
      const plain = await make('in_planning');
      const finished = await make('done');
      await set(finished, `due_date = '2020-01-01'`); // concluída: não conta como atrasada
      const both = await make('in_testing');
      await set(both, `is_blocked = true, block_reason = 'Recente', due_date = '2020-01-01'`);
      // created_at explícito: a ordem dentro de cada grupo não pode depender do desempate pelo id.
      for (const [i, id] of [blockedOld, late, plain, finished, both].entries()) await set(id, `created_at = now() - interval '${5 - i} minutes'`);
      const dead = await fx.epic(await fx.objective(await fx.project('Eliminado da vista', { teams: [team], deleted: true })));
      await set(await make('in_planning', dead), `is_blocked = true, block_reason = 'Não conta'`);

      const page = async (n: number, query = '') =>
        (await as('leaderA').get(`/api/teams/${team}/work?page=${n}&pageSize=2${query}`).expect(200)).body;
      const pages = [await page(1), await page(2), await page(3)];
      expect(pages[0].counts).toEqual({ planned: 2, in_progress: 2, done: 1, blocked: 2, overdue: 2 });
      for (const p of pages) expect(p.total).toBe(5);
      expect(pages.flatMap((p) => p.items.map((i: { id: string }) => i.id))).toEqual([both, blockedOld, late, finished, plain]);
      const planned = await page(1, '&group=planned');
      expect(planned).toMatchObject({ total: 2, counts: { planned: 2, blocked: 2 } });
      expect(planned.items.map((i: { id: string }) => i.id)).toEqual([blockedOld, plain]);
      expect((await page(1, '&group=overdue')).items.map((i: { id: string }) => i.id)).toEqual([both, late]);
    });
  });

  describe('Comparação da sprint (CA07.2)', () => {
    it('CA07.2, RF27, RN10, RN37 — planeado (com as retiradas) e concluído, em horas e SP em separado, com a estimativa do início e a atual; acrescentadas assinaladas', async () => {
      const keep = await task({ estimateHours: 10, storyPoints: 5, state: 'done' });
      const grew = await task({ estimateHours: 12, storyPoints: 3, state: 'in_development' });
      const removed = await task({ estimateHours: 6, storyPoints: 2 });
      const added = await task({ estimateHours: 4, storyPoints: 1, state: 'delivered' });
      const [{ id: sprintId }] = await t.db.query(
        `INSERT INTO planning.sprint (team_id, start_date, end_date, status, started_at) VALUES ($1, '2031-09-01', '2031-09-12', 'active', now()) RETURNING id`,
        [teamA],
      );
      const link = (taskId: string, h: number, sp: number, extra = '') =>
        t.db.query(
          `INSERT INTO planning.sprint_task (sprint_id, task_id, start_estimate_hours, start_story_points${extra ? ', added_after_start' : ''})
           VALUES ($1, $2, $3, $4${extra ? ', true' : ''})`,
          [sprintId, taskId, h, sp],
        );
      await link(keep, 8, 5);
      await link(grew, 9, 3);
      await link(removed, 6, 2);
      await link(added, 4, 1, 'added');
      await t.db.query(`UPDATE planning.sprint_task SET left_at = now(), left_reason = 'removed' WHERE sprint_id = $1 AND task_id = $2`, [sprintId, removed]);

      const res = await as('memberA').get(`/api/sprints/${sprintId}/progress`).expect(200);
      expect(res.body).toMatchObject({
        status: 'active',
        planned: { startHours: 27, currentHours: 32, startStoryPoints: 11, currentStoryPoints: 11, tasks: 4 },
        done: { startHours: 12, currentHours: 14, startStoryPoints: 6, currentStoryPoints: 6, tasks: 2 },
      });
      const byId = new Map(res.body.tasks.map((x: { id: string }) => [x.id, x]));
      expect(byId.get(removed)).toMatchObject({ leftReason: 'removed', done: false, startEstimateHours: 6 });
      expect(byId.get(added)).toMatchObject({ addedAfterStart: true, done: true });
      expect(byId.get(grew)).toMatchObject({ startEstimateHours: 9, currentEstimateHours: 12, done: false });
      await as('outsider').get(`/api/sprints/${sprintId}/progress`).expect(403);
    });

    it('CA07.2 — numa sprint «Planeada», as estimativas do início são nulas', async () => {
      const id = await task({ estimateHours: 5, storyPoints: 2 });
      const [{ id: sprintId }] = await t.db.query(`INSERT INTO planning.sprint (team_id, start_date, end_date) VALUES ($1, '2031-10-06', '2031-10-17') RETURNING id`, [teamA]);
      await t.db.query(`INSERT INTO planning.sprint_task (sprint_id, task_id) VALUES ($1, $2)`, [sprintId, id]);
      const res = await as('leaderA').get(`/api/sprints/${sprintId}/progress`).expect(200);
      expect(res.body.planned).toEqual({ startHours: null, currentHours: 5, startStoryPoints: null, currentStoryPoints: 2, tasks: 1 });
      expect(res.body.done).toMatchObject({ tasks: 0, currentHours: 0 });
    });
  });
});
