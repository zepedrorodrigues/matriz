import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I12 — Transferências: US09 CA09.2–CA09.5, CA09.7, CA09.8; RN14, RN15, RN20, RN22, RN23, RN32, RN33; §3.1.
 * Decisões do humano (F22): o responsável mantém-se só se for membro da equipa de destino (1a); as
 * subtarefas concluídas mudam de equipa e ficam na sprint em que foram feitas (2a); a consulta do
 * histórico (CA09.2) é verificada no I13, aqui verifica-se o registo (3a).
 */
describe('I12 — transferências entre equipas', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, teamB: string, teamC: string, teamOff: string, projectId: string, epicId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
    };
  };
  const transfer = (who: string, taskId: string, targetTeamId: string) => as(who).post(`/api/tasks/${taskId}/transfer`, { targetTeamId });
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, estimateHours: 4, ...opts });
  const sub = (parentTaskId: string, opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => task({ epicId: undefined, parentTaskId, ...opts });
  const row = async (id: string) =>
    (await t.db.query(`SELECT team_id, original_team_id, assignee_id, state FROM work.task WHERE id = $1`, [id]))[0] as {
      team_id: string;
      original_team_id: string;
      assignee_id: string | null;
      state: string;
    };
  const events = (id: string, type?: string) =>
    t.db.query(
      `SELECT event_type, old_value, new_value, author_id, occurred_at FROM history.history_event
       WHERE entity_id = $1 AND ($2::text IS NULL OR event_type = $2) ORDER BY id`,
      [id, type ?? null],
    );
  const sprint = async (teamId: string, status: 'planned' | 'active', dates: [string, string], taskIds: string[]) => {
    const [{ id }] = await t.db.query(
      `INSERT INTO planning.sprint (team_id, start_date, end_date, status, started_at)
       VALUES ($1, $2, $3, $4::planning.sprint_status, CASE WHEN $4 = 'active' THEN now() END) RETURNING id`,
      [teamId, dates[0], dates[1], status],
    );
    for (const taskId of taskIds) {
      await t.db.query(
        `INSERT INTO planning.sprint_task (sprint_id, task_id, start_estimate_hours) VALUES ($1, $2, CASE WHEN $3 = 'active' THEN 4 END)`,
        [id, taskId, status],
      );
    }
    return id as string;
  };
  /** Backlog da equipa: id → sprint planeada (`plannedSprintId`), ou null. */
  const backlog = async (teamId: string, who: string) =>
    new Map<string, string | null>(
      (await as(who).get(`/api/teams/${teamId}/backlog?pageSize=100`).expect(200)).body.items.map((i: { id: string; plannedSprintId: string | null }) => [i.id, i.plannedSprintId]),
    );

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, manager: {}, otherManager: {}, leaderA: {}, memberA: {}, shared: {}, leaderB: {}, leaderC: {} })) {
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
    await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 50 WHERE user_id = $1`, [ids.shared]);
    teamC = await fx.team('Fora do projeto', [{ userId: ids.leaderC, role: 'leader' }]);
    teamOff = await fx.team('Desativada', [{ userId: ids.leaderC, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA, teamB, teamOff] });
    await fx.project('Outro', { managers: [ids.otherManager], teams: [teamA] });
    await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [teamOff]);
    epicId = await fx.epic(await fx.objective(projectId));
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA09.3, RN14, RN32 — o gestor transfere: a nova equipa passa a responsável, a original mantém-se e o histórico regista o autor e a data/hora', async () => {
    const id = await task({ title: 'Para a Beta' });
    const res = await transfer('manager', id, teamB).expect(200);
    expect(res.body).toEqual({
      taskId: id,
      previousTeamId: teamA,
      newTeamId: teamB,
      originalTeamId: teamA,
      transferredSubtaskIds: [],
      removedFromSprintId: null,
      transferredBy: ids.manager,
      transferredAt: expect.any(String),
    });
    expect(await row(id)).toMatchObject({ team_id: teamB, original_team_id: teamA });
    const [event] = await events(id, 'team_transferred');
    expect(event).toMatchObject({
      author_id: ids.manager,
      old_value: { teamId: teamA, assigneeId: null },
      new_value: { teamId: teamB, originalTeamId: teamA, assigneeId: null },
    });
    expect(event.occurred_at.toISOString()).toBe(res.body.transferredAt);
    expect((await as('manager').get(`/api/tasks/${id}`).expect(200)).body).toMatchObject({ teamId: teamB, originalTeamId: teamA });
    // EC09.2: uma segunda transferência acrescenta outro evento; a equipa original continua a mesma.
    await transfer('admin', id, teamA).expect(200);
    expect((await events(id, 'team_transferred')).map((e: { new_value: { teamId: string; originalTeamId: string } }) => [e.new_value.teamId, e.new_value.originalTeamId])).toEqual([
      [teamB, teamA],
      [teamA, teamA],
    ]);
  });

  it('CA09.4, §3.1 — membro, líder (de origem ou de destino) e gestor de outro projeto: 403 e a equipa mantém-se; o administrador transfere', async () => {
    const id = await task();
    for (const who of ['memberA', 'leaderA', 'leaderB', 'otherManager']) {
      await transfer(who, id, teamB).expect(403);
    }
    expect((await row(id)).team_id).toBe(teamA);
    expect(await events(id, 'team_transferred')).toEqual([]);
    await transfer('admin', id, teamB).expect(200);
    expect((await row(id)).team_id).toBe(teamB);
    await request(t.server).post(`/api/tasks/${id}/transfer`).send({ targetTeamId: teamA }).expect(401);
  });

  it('CA09.5, RN22 — as subtarefas passam com a tarefa principal, cada uma com a transferência no histórico; a subtarefa sozinha não se transfere (409)', async () => {
    const parent = await task({ title: 'Principal' });
    const s1 = await sub(parent);
    const s2 = await sub(parent, { state: 'done' });
    const gone = await sub(parent);
    await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [gone]);
    await transfer('manager', s1, teamB).expect(409);
    expect((await row(s1)).team_id).toBe(teamA);
    const res = await transfer('manager', parent, teamB).expect(200);
    expect([...res.body.transferredSubtaskIds].sort()).toEqual([s1, s2].sort());
    for (const s of [s1, s2]) {
      expect(await row(s)).toMatchObject({ team_id: teamB, original_team_id: teamA });
      expect(await events(s, 'team_transferred')).toEqual([
        expect.objectContaining({ author_id: ids.manager, new_value: expect.objectContaining({ teamId: teamB, originalTeamId: teamA, withParentTaskId: parent }) }),
      ]);
    }
    expect((await row(gone)).team_id).toBe(teamA);
  });

  it('CA09.7, RN20 — «Terminada» e «Entregue» não se transferem (409) e a equipa mantém-se', async () => {
    for (const state of ['done', 'delivered']) {
      const id = await task({ state });
      const res = await transfer('manager', id, teamB).expect(409);
      expect(res.body.detail).toContain('não pode ser transferida');
      expect((await row(id)).team_id).toBe(teamA);
    }
  });

  it('RN23, RN33 — destino inativo ou fora do projeto: 422; a mesma equipa: 409; destino inválido: 400; tarefa inexistente: 404', async () => {
    const id = await task();
    await transfer('manager', id, teamOff).expect(422);
    await transfer('manager', id, teamC).expect(422);
    await transfer('manager', id, teamA).expect(409);
    await transfer('manager', id, 'nao-e-uuid').expect(400);
    await as('manager').post(`/api/tasks/${id}/transfer`, { targetTeamId: teamB, extra: 1 }).expect(400);
    await transfer('admin', '00000000-0000-4000-8000-000000000999', teamB).expect(404);
    expect((await row(id)).team_id).toBe(teamA);
  });

  it('RN15, decisão 1a — o responsável mantém-se se for membro da equipa de destino; senão a atribuição sai e fica no histórico', async () => {
    const kept = await task({ assigneeId: ids.shared });
    const dropped = await task({ assigneeId: ids.memberA });
    const parent = await task();
    const subDropped = await sub(parent, { assigneeId: ids.memberA });
    await transfer('manager', kept, teamB).expect(200);
    await transfer('manager', dropped, teamB).expect(200);
    await transfer('manager', parent, teamB).expect(200);
    expect((await row(kept)).assignee_id).toBe(ids.shared);
    expect(await events(kept, 'assignee_changed')).toEqual([]);
    for (const id of [dropped, subDropped]) {
      expect((await row(id)).assignee_id).toBeNull();
      expect(await events(id, 'team_transferred')).toEqual([
        expect.objectContaining({ old_value: { teamId: teamA, assigneeId: ids.memberA }, new_value: expect.objectContaining({ assigneeId: null }) }),
      ]);
      expect(await events(id, 'assignee_changed')).toEqual([
        expect.objectContaining({ old_value: { assigneeId: ids.memberA }, new_value: { assigneeId: null, reason: 'transferred' } }),
      ]);
    }
  });

  describe('Sprints (CA09.8, RN20, EC09.3)', () => {
    it('CA09.8 — sprint «Planeada» da origem: a tarefa sai da sprint e passa para o backlog da equipa de destino', async () => {
      const id = await task({ title: 'Planeada' });
      const sprintId = await sprint(teamA, 'planned', ['2032-01-05', '2032-01-16'], [id]);
      expect((await backlog(teamA, 'leaderA')).get(id)).toBe(sprintId);
      const res = await transfer('manager', id, teamB).expect(200);
      expect(res.body.removedFromSprintId).toBe(sprintId);
      const detail = (await as('leaderA').get(`/api/sprints/${sprintId}`).expect(200)).body;
      expect([...detail.tasks, ...detail.leftTasks].map((x: { id: string }) => x.id)).not.toContain(id);
      expect((await backlog(teamB, 'leaderB')).get(id)).toBeNull();
      expect((await backlog(teamA, 'leaderA')).has(id)).toBe(false);
      const [{ event_type, new_value }] = (await events(sprintId)).slice(-1);
      expect([event_type, new_value]).toEqual(['task_removed', { taskId: id, sprintStatus: 'planned', reason: 'transferred' }]);
    });

    it('CA09.8, RF27, decisão 2a — sprint «Ativa»: as não concluídas saem como transferidas (e continuam no planeado do início); a subtarefa concluída fica na sprint', async () => {
      const parent = await task({ title: 'Na sprint ativa', state: 'in_development' });
      const open = await sub(parent, { state: 'in_development' });
      const finished = await sub(parent, { state: 'done' });
      const sprintId = await sprint(teamA, 'active', ['2032-02-02', '2032-02-13'], [parent, open, finished]);
      const res = await transfer('manager', parent, teamB).expect(200);
      expect(res.body.removedFromSprintId).toBe(sprintId);
      const detail = (await as('leaderA').get(`/api/sprints/${sprintId}`).expect(200)).body;
      expect(detail.tasks.map((x: { id: string }) => x.id)).toEqual([finished]);
      expect(detail.leftTasks.map((x: { id: string; leftReason: string }) => [x.id, x.leftReason]).sort()).toEqual(
        [
          [parent, 'transferred'],
          [open, 'transferred'],
        ].sort(),
      );
      const progress = (await as('leaderA').get(`/api/sprints/${sprintId}/progress`).expect(200)).body;
      // RF27: as transferidas continuam no planeado do início (3 tarefas, 2 com horas: só as subtarefas contam, RN22).
      expect(progress.planned).toMatchObject({ tasks: 3 });
      expect((await backlog(teamB, 'leaderB')).get(open)).toBeNull();
      expect((await row(finished)).team_id).toBe(teamB);
    });

    it('a sprint terminada não muda: a tarefa transferida depois do fim fica no histórico da sprint como estava', async () => {
      const id = await task({ state: 'in_testing' });
      const sprintId = await sprint(teamA, 'planned', ['2032-03-01', '2032-03-12'], [id]);
      await t.db.query(`UPDATE planning.sprint SET status = 'closed', started_at = now(), closed_at = now() WHERE id = $1`, [sprintId]);
      const res = await transfer('manager', id, teamB).expect(200);
      expect(res.body.removedFromSprintId).toBeNull();
      expect((await t.db.query(`SELECT left_reason FROM planning.sprint_task WHERE sprint_id = $1 AND task_id = $2`, [sprintId, id]))[0].left_reason).toBeNull();
    });
  });
});
