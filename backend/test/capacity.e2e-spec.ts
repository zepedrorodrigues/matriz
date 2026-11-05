import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I10 — Capacidade: US05 CA05.1–CA05.7, CA05.9–CA05.11; RN06, RN19, RN22, RN27; SEC06, SEC07; §3.1.
 * Decisões do humano (F20): CA05.8 (alertas) no I11; os gestores dos projetos da equipa consultam o seu
 * planeamento, só em leitura. Datas de 2031 com 10 dias úteis (6 a 17 de janeiro).
 */
describe('I10 — capacidade', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, teamB: string, epicA: string, epicB: string;
  const TEN_DAYS = { startDate: '2031-01-06', endDate: '2031-01-17' };

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };
  const capacity = async (sprintId: string, who = 'leaderA') => (await as(who).get(`/api/sprints/${sprintId}/capacity`).expect(200)).body;
  /** Sprint planeada diretamente na base, com as tarefas indicadas (a capacidade não depende do estado). */
  const sprintWith = async (teamId: string, dates: { startDate: string; endDate: string }, taskIds: string[]) => {
    const [{ id }] = await t.db.query(`INSERT INTO planning.sprint (team_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING id`, [
      teamId,
      dates.startDate,
      dates.endDate,
    ]);
    for (const taskId of taskIds) await t.db.query(`INSERT INTO planning.sprint_task (sprint_id, task_id) VALUES ($1, $2)`, [id, taskId]);
    return id as string;
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]>) => fx.task({ epicId: epicA, teamId: teamA, createdBy: ids.leaderA, ...opts });

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, manager: {}, otherManager: {}, leaderA: {}, memberA: {}, shared: {}, leaderB: {} })) {
      const u = await fx.user(k, opts);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
      { userId: ids.shared, role: 'member' },
    ]);
    teamB = await fx.team('Beta', [
      { userId: ids.leaderB, role: 'leader' },
      { userId: ids.shared, role: 'member' },
    ]);
    // CA05.10: o membro partilhado está a 50 % em cada equipa.
    await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 50 WHERE user_id = $1`, [ids.shared]);
    const project = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA, teamB] });
    await fx.project('Projeto sem a Alfa', { managers: [ids.otherManager], teams: [teamB] });
    epicA = await fx.epic(await fx.objective(project));
    epicB = epicA;
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA05.6, CA05.7, CA05.10, CA05.11 — 8 h × 10 dias × alocação: 80 h por membro a 100 %, 40 h a 50 % em cada equipa; a equipa soma todos, líder incluído', async () => {
    const sprintA = await sprintWith(teamA, TEN_DAYS, []);
    const sprintB = await sprintWith(teamB, TEN_DAYS, []);
    const a = await capacity(sprintA);
    expect(a).toMatchObject({ workingDays: 10, capacityHours: 200, plannedHours: 0, remainingHours: 200, overloaded: false });
    expect(a.members.map((m: { userId: string; capacityHours: number; role: string }) => [m.userId, m.role, m.capacityHours])).toEqual(
      expect.arrayContaining([
        [ids.leaderA, 'leader', 80],
        [ids.memberA, 'member', 80],
        [ids.shared, 'member', 40],
      ]),
    );
    const b = await capacity(sprintB, 'leaderB');
    expect(b.capacityHours).toBe(120);
    expect(b.members.find((m: { userId: string }) => m.userId === ids.shared)).toMatchObject({ capacityHours: 40, allocationPct: 50 });
    // CA05.11: um líder e um membro a 100 % → 160 h.
    const pair = await fx.team('Par', [{ userId: ids.leaderB, role: 'leader' }]);
    await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 100 WHERE team_id = $1`, [pair]);
    const extra = await fx.user('Membro do par');
    await t.db.query(`INSERT INTO organization.team_membership (team_id, user_id, role, allocation_pct) VALUES ($1, $2, 'member', 100)`, [pair, extra.id]);
    expect((await capacity(await sprintWith(pair, TEN_DAYS, []), 'leaderB')).capacityHours).toBe(160);
  });

  it('CA05.1, CA05.2, CA05.3, CA05.4, RN19, RN27 — totais do wireframe: 160 h de capacidade, 172 h planeadas (−12), 34 SP, uma sem SP; Rui em sobrecarga', async () => {
    const ana = await fx.user('Ana');
    const rui = await fx.user('Rui');
    const team = await fx.team('Wireframe', [
      { userId: ana.id, role: 'leader' },
      { userId: rui.id, role: 'member' },
    ]);
    const anaToken = await t.token({ email: ana.email });
    const make = (assigneeId: string, estimateHours: number, storyPoints?: number) =>
      fx.task({ epicId: epicB, teamId: team, createdBy: ana.id, assigneeId, estimateHours, storyPoints });
    const tasks = [await make(rui.id, 40, 13), await make(ana.id, 24, 8), await make(rui.id, 62, 8), await make(ana.id, 30, 5), await make(ana.id, 16)];
    await t.db.query(`INSERT INTO organization.project_team (project_id, team_id) SELECT o.project_id, $1 FROM work.epic e JOIN work.objective o ON o.id = e.objective_id WHERE e.id = $2`, [team, epicB]);
    const sprintId = await sprintWith(team, { startDate: '2031-02-03', endDate: '2031-02-14' }, tasks);
    const res = await request(t.server).get(`/api/sprints/${sprintId}/capacity`).set('Authorization', `Bearer ${anaToken}`).expect(200);
    expect(res.body).toMatchObject({
      capacityHours: 160,
      plannedHours: 172,
      remainingHours: -12,
      plannedStoryPoints: 34,
      tasksWithoutStoryPoints: 1,
      overloaded: true,
    });
    const byUser = new Map(res.body.members.map((m: { userId: string }) => [m.userId, m]));
    expect(byUser.get(ana.id)).toMatchObject({ plannedHours: 70, remainingHours: 10, overloaded: false });
    expect(byUser.get(rui.id)).toMatchObject({ plannedHours: 102, remainingHours: -22, overloaded: true });
  });

  it('CA05.9, RN22 — subtarefa de 8 h na sprint B: conta só na B; a tarefa principal (na A) não conta em nenhuma', async () => {
    const parent = await task({ estimateHours: 50, storyPoints: 13, assigneeId: ids.memberA });
    const sub = await task({ epicId: undefined, parentTaskId: parent, estimateHours: 8, storyPoints: 3, assigneeId: ids.memberA });
    const sprintA = await sprintWith(teamA, { startDate: '2031-03-03', endDate: '2031-03-14' }, [parent]);
    const sprintB = await sprintWith(teamA, { startDate: '2031-03-17', endDate: '2031-03-28' }, [sub]);
    const a = await capacity(sprintA);
    const b = await capacity(sprintB);
    expect(a).toMatchObject({ plannedHours: 0, plannedStoryPoints: 0 });
    expect(b).toMatchObject({ plannedHours: 8, plannedStoryPoints: 3 });
    expect(b.members.find((m: { userId: string }) => m.userId === ids.memberA).plannedHours).toBe(8);
  });

  it('CA05.5, SEC06 — o líder ajusta as horas de um membro: a capacidade dele e da equipa refletem o ajuste e a sobrecarga é recalculada; sem motivo; repor volta ao cálculo', async () => {
    const big = await task({ estimateHours: 60, assigneeId: ids.memberA });
    const sprintId = await sprintWith(teamA, { startDate: '2031-04-07', endDate: '2031-04-18' }, [big]);
    expect((await capacity(sprintId)).members.find((m: { userId: string }) => m.userId === ids.memberA)).toMatchObject({ capacityHours: 80, overloaded: false });
    const res = await as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours: 32.5 }).expect(200);
    expect(res.body.capacityHours).toBe(152.5);
    expect(res.body.members.find((m: { userId: string }) => m.userId === ids.memberA)).toMatchObject({
      capacityHours: 32.5,
      availabilityAdjusted: true,
      remainingHours: -27.5,
      overloaded: true,
    });
    await as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours: 20, reason: 'férias' }).expect(400);
    const [row] = await t.db.query(`SELECT * FROM planning.availability_adjustment WHERE sprint_id = $1`, [sprintId]);
    expect(Object.keys(row).sort()).toEqual(['available_hours', 'sprint_id', 'updated_at', 'updated_by', 'user_id']);
    const [event] = await t.db.query(`SELECT event_type, new_value FROM history.history_event WHERE entity_id = $1 ORDER BY id DESC LIMIT 1`, [sprintId]);
    expect(event).toEqual({ event_type: 'availability_adjusted', new_value: { userId: ids.memberA, availableHours: 32.5 } });
    const reset = await as('leaderA').delete(`/api/sprints/${sprintId}/availability/${ids.memberA}`).expect(200);
    expect(reset.body.members.find((m: { userId: string }) => m.userId === ids.memberA)).toMatchObject({ capacityHours: 80, availabilityAdjusted: false });
    await as('leaderA').delete(`/api/sprints/${sprintId}/availability/${ids.memberA}`).expect(404);
  });

  it('§3.1 — só o líder ajusta (403 para membro, administrador e gestor); fora da equipa → 422; valores inválidos → 400; sprint terminada → 409', async () => {
    const sprintId = await sprintWith(teamA, { startDate: '2031-05-05', endDate: '2031-05-16' }, []);
    for (const who of ['memberA', 'admin', 'manager']) {
      await as(who).put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours: 10 }).expect(403);
    }
    await as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.leaderB}`, { availableHours: 10 }).expect(422);
    for (const availableHours of [-1, 10000, 1.234, '8']) {
      await as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours }).expect(400);
    }
    expect((await t.db.query(`SELECT count(*)::int AS n FROM planning.availability_adjustment WHERE sprint_id = $1`, [sprintId]))[0].n).toBe(0);
    await t.db.query(`UPDATE planning.sprint SET status = 'closed', started_at = now(), closed_at = now() WHERE id = $1`, [sprintId]);
    await as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours: 10 }).expect(409);
  });

  it('SEC07, F20 — o líder vê todos; o membro só a sua linha; o gestor de um projeto da equipa e o administrador só os totais; um gestor sem projetos da equipa → 403', async () => {
    const sprintId = await sprintWith(teamA, { startDate: '2031-06-02', endDate: '2031-06-13' }, [await task({ estimateHours: 10, assigneeId: ids.memberA })]);
    expect((await capacity(sprintId, 'leaderA')).members).toHaveLength(3);
    const own = await capacity(sprintId, 'memberA');
    expect(own.members.map((m: { userId: string }) => m.userId)).toEqual([ids.memberA]);
    expect(own).toMatchObject({ capacityHours: 200, plannedHours: 10 });
    for (const who of ['manager', 'admin']) {
      const body = await capacity(sprintId, who);
      expect(body).toMatchObject({ capacityHours: 200, plannedHours: 10, members: [] });
    }
    // O gestor de um projeto da equipa também vê as sprints e o backlog, só em leitura.
    await as('manager').get(`/api/teams/${teamA}/sprints`).expect(200);
    await as('manager').get(`/api/teams/${teamA}/backlog`).expect(200);
    await as('manager').post(`/api/teams/${teamA}/sprints`, { startDate: '2031-07-07', endDate: '2031-07-18' }).expect(403);
    await as('otherManager').get(`/api/sprints/${sprintId}/capacity`).expect(403);
    await as('otherManager').get(`/api/teams/${teamA}/sprints`).expect(403);
  });

  it('RN37, RN38 — as tarefas retiradas, as que saíram no fim e as eliminadas não contam nas horas planeadas', async () => {
    const kept = await task({ estimateHours: 5 });
    const removed = await task({ estimateHours: 7 });
    const deleted = await task({ estimateHours: 11 });
    const sprintId = await sprintWith(teamA, { startDate: '2031-08-04', endDate: '2031-08-15' }, [kept, removed, deleted]);
    await t.db.query(`UPDATE planning.sprint_task SET left_at = now(), left_reason = 'removed' WHERE sprint_id = $1 AND task_id = $2`, [sprintId, removed]);
    await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [deleted]);
    expect((await capacity(sprintId)).plannedHours).toBe(5);
  });
});
