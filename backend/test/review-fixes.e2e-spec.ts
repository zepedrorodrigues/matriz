import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I14 (Ex. 9.1) — regressões das correções da revisão assistida por IA (docs/verification.md). Decisões do
 * humano (F23): 1a — o responsável de outra equipa tem, na tarefa atribuída, os direitos do membro; 2a — quem
 * não é da equipa vê nas vistas de planeamento só as tarefas dos projetos que vê; 3a — os participantes
 * mantêm-se na transferência e ficam registados; 4a — os alertas leem na transação do evento.
 */
describe('I14 — correções da revisão', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, teamB: string, teamOut: string, projectId: string, epicId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, estimateHours: 4, ...opts });
  const sprint = async (teamId: string, status: 'planned' | 'active', dates: [string, string], taskIds: string[] = []) => {
    const [{ id }] = await t.db.query(
      `INSERT INTO planning.sprint (team_id, start_date, end_date, status, started_at)
       VALUES ($1, $2, $3, $4::planning.sprint_status, CASE WHEN $4 = 'active' THEN now() END) RETURNING id`,
      [teamId, dates[0], dates[1], status],
    );
    for (const taskId of taskIds) {
      await t.db.query(`INSERT INTO planning.sprint_task (sprint_id, task_id, start_estimate_hours) VALUES ($1, $2, 4)`, [id, taskId]);
    }
    return id as string;
  };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  /** Outra ligação muda a equipa da tarefa numa transação aberta (uma transferência em curso) enquanto `run` corre. */
  const whileTransferring = async (taskId: string, newTeamId: string, run: () => Promise<request.Response>) => {
    const runner = t.db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT id FROM work.task WHERE id = $1 FOR UPDATE`, [taskId]);
      await runner.query(`UPDATE work.task SET team_id = $2 WHERE id = $1`, [taskId, newTeamId]);
      const pending = run();
      await wait(600);
      await runner.commitTransaction();
      return await pending;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  };
  const alerts = async (who: string, type: string) =>
    ((await as(who).get('/api/alerts?pageSize=100').expect(200)).body.items as { type: string; task: { id: string } | null; sprintId: string | null }[]).filter(
      (a) => a.type === type,
    );

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const k of ['manager', 'otherManager', 'leaderA', 'memberA', 'leaderB', 'outsider', 'managerMember']) {
      const u = await fx.user(k);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
      { userId: ids.managerMember, role: 'member' },
    ]);
    await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 50 WHERE user_id = $1`, [ids.managerMember]);
    teamB = await fx.team('Beta', [
      { userId: ids.leaderB, role: 'leader' },
      { userId: ids.managerMember, role: 'member' },
    ]);
    await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 50 WHERE user_id = $1`, [ids.managerMember]);
    teamOut = await fx.team('Fora', [{ userId: ids.outsider, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager, ids.managerMember], teams: [teamA, teamB] });
    epicId = await fx.epic(await fx.objective(projectId));
  });

  afterAll(async () => {
    await t.close();
  });

  it('Correção 1, RN03, CA09.1 — o responsável de outra equipa (fora do projeto) vê e trabalha na tarefa atribuída, mas não vê o projeto', async () => {
    const id = await task({ state: 'ready_for_development' });
    const criterion = await fx.criterion(id, ids.leaderA);
    await as('manager').patch(`/api/tasks/${id}`, { assigneeId: ids.outsider, assignmentJustification: 'Especialista da equipa Fora' }).expect(200);
    await as('outsider').get(`/api/tasks/${id}`).expect(200);
    await as('outsider').post(`/api/tasks/${id}/state`, { state: 'in_development' }).expect(200);
    await as('outsider').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'À espera do acesso' }).expect(200);
    await as('outsider').patch(`/api/tasks/${id}/acceptance-criteria/${criterion}`, { isMet: true }).expect(200);
    await as('outsider').post(`/api/tasks/${id}/comments`, { body: 'A tratar.' }).expect(201);
    // Só os direitos do membro: não muda a prioridade nem vê o projeto ou outras tarefas.
    await as('outsider').patch(`/api/tasks/${id}`, { priority: 'high' }).expect(403);
    await as('outsider').get(`/api/projects/${projectId}`).expect(403);
    await as('outsider').get(`/api/tasks/${await task()}`).expect(403);
    // Deixa de estar atribuída → deixa de a ver.
    await as('manager').patch(`/api/tasks/${id}`, { assigneeId: null }).expect(200);
    await as('outsider').get(`/api/tasks/${id}`).expect(403);
  });

  it('Correção 2, CAT06 — o gestor de um projeto vê no planeamento de uma equipa partilhada só as tarefas do seu projeto; a equipa vê todas', async () => {
    const team = await fx.team('Partilhada', [{ userId: ids.leaderB, role: 'leader' }]);
    const mine = await fx.project('Meu', { managers: [ids.otherManager], teams: [team] });
    const theirs = await fx.project('Alheio', { managers: [ids.manager], teams: [team] });
    const epicMine = await fx.epic(await fx.objective(mine));
    const epicTheirs = await fx.epic(await fx.objective(theirs));
    const inSprintMine = await fx.task({ epicId: epicMine, teamId: team, createdBy: ids.leaderB, estimateHours: 4 });
    const inSprintTheirs = await fx.task({ epicId: epicTheirs, teamId: team, createdBy: ids.leaderB, estimateHours: 4, title: 'Confidencial' });
    const backlogMine = await fx.task({ epicId: epicMine, teamId: team, createdBy: ids.leaderB });
    const backlogTheirs = await fx.task({ epicId: epicTheirs, teamId: team, createdBy: ids.leaderB });
    const sprintId = await sprint(team, 'active', ['2033-01-03', '2033-01-14'], [inSprintMine, inSprintTheirs]);
    const idsOf = (items: { id: string }[]) => items.map((i) => i.id).sort();

    expect(idsOf((await as('otherManager').get(`/api/teams/${team}/backlog?pageSize=100`).expect(200)).body.items)).toEqual([backlogMine]);
    expect(idsOf((await as('leaderB').get(`/api/teams/${team}/backlog?pageSize=100`).expect(200)).body.items)).toEqual([backlogMine, backlogTheirs].sort());
    const work = (await as('otherManager').get(`/api/teams/${team}/work?pageSize=100`).expect(200)).body;
    expect(idsOf(work.items)).toEqual([inSprintMine, backlogMine].sort());
    expect(work.total).toBe(2);
    expect(idsOf((await as('otherManager').get(`/api/sprints/${sprintId}`).expect(200)).body.tasks)).toEqual([inSprintMine]);
    expect(idsOf((await as('otherManager').get(`/api/sprints/${sprintId}/progress`).expect(200)).body.tasks)).toEqual([inSprintMine]);
    expect(idsOf((await as('leaderB').get(`/api/sprints/${sprintId}`).expect(200)).body.tasks)).toEqual([inSprintMine, inSprintTheirs].sort());
  });

  it('Correção 3, RN40, RN32 — na transferência, os participantes mantêm-se e ficam registados no histórico', async () => {
    const id = await task();
    await as('leaderA').post(`/api/tasks/${id}/participants`, { userId: ids.memberA }).expect(201);
    await as('manager').post(`/api/tasks/${id}/transfer`, { targetTeamId: teamB }).expect(200);
    expect((await as('manager').get(`/api/tasks/${id}`).expect(200)).body.participants.map((p: { user: { id: string } }) => p.user.id)).toEqual([ids.memberA]);
    const [event] = await t.db.query(`SELECT new_value FROM history.history_event WHERE entity_id = $1 AND event_type = 'team_transferred'`, [id]);
    expect(event.new_value.participantIds).toEqual([ids.memberA]);
  });

  it('Correção 5, RN01, RN20 — planear uma tarefa enquanto é transferida: espera pela transferência e recusa (422); não fica na sprint da equipa antiga', async () => {
    const id = await task({ title: 'Em transferência' });
    const sprintId = await sprint(teamA, 'planned', ['2033-02-07', '2033-02-18']);
    const res = await whileTransferring(id, teamB, () => as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: id }).then((r) => r));
    expect(res.status).toBe(422);
    expect(await t.db.query(`SELECT 1 FROM planning.sprint_task WHERE sprint_id = $1 AND task_id = $2`, [sprintId, id])).toEqual([]);
  });

  it('Correção 6, RN03 — atribuir enquanto a tarefa é transferida: o líder não fica a atribuir a outra equipa sem justificação (409)', async () => {
    const id = await task({ title: 'Atribuição em corrida' });
    const res = await whileTransferring(id, teamB, () => as('leaderA').patch(`/api/tasks/${id}`, { assigneeId: ids.memberA }).then((r) => r));
    expect(res.status).toBe(409);
    expect((await t.db.query(`SELECT assignee_id FROM work.task WHERE id = $1`, [id]))[0].assignee_id).toBeNull();
  });

  it('Correção 7, RN22, CA05.8 — criar e eliminar a subtarefa volta a verificar a sobrecarga da sprint da tarefa principal', async () => {
    // A Alfa tem 80 h + 80 h + 40 h (a 50 %) = 200 h; o membro, 80 h. Principal de 90 h → sobrecarga individual.
    const parent = await task({ assigneeId: ids.memberA, estimateHours: 90, title: 'Principal pesada' });
    const sprintId = await sprint(teamA, 'planned', ['2033-03-07', '2033-03-18']);
    await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: parent }).expect(201);
    const mine = async () => (await alerts('memberA', 'individual_overload')).filter((a) => a.sprintId === sprintId);
    expect(await mine()).toHaveLength(1);
    // Com uma subtarefa, a principal passa a contar 0: deixa de haver sobrecarga.
    const sub = await as('leaderA').post(`/api/projects/${projectId}/tasks`, { parentTaskId: parent, title: 'Parte', estimateHours: 2 }).expect(201);
    // Sem a subtarefa, volta às 90 h: nova passagem a sobrecarga → novo alerta.
    await as('leaderA').delete(`/api/tasks/${sub.body.id}`).expect(204);
    expect(await mine()).toHaveLength(2);
  });

  it('Correção 8, RN09, §3.1 — quem é gestor do projeto e também membro da equipa cria como gestor: sem alerta aos líderes', async () => {
    const created = await as('managerMember').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do gestor-membro' }).expect(201);
    expect((await alerts('leaderA', 'member_task_created')).filter((a) => a.task?.id === created.body.id)).toEqual([]);
    const byMember = await as('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do membro' }).expect(201);
    expect((await alerts('leaderA', 'member_task_created')).filter((a) => a.task?.id === byMember.body.id)).toHaveLength(1);
  });
});
