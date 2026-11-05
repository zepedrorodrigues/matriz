import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/** I3, passo 3 — Equipas de um projeto: CA01.3–CA01.5; RN23, RN33; §3.1; F18 (só se associa). */
describe('I3 — equipas de um projeto', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  let manager: { id: string };
  let projectId: string, teamA: string, teamB: string, inactiveTeam: string;

  const as = (who: string) => ({
    get: (url: string) => request(t.server).get(url).set('Authorization', `Bearer ${tokens[who]}`),
    post: (url: string, body: object) => request(t.server).post(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  });
  const links = async () =>
    (await t.db.query(`SELECT team_id FROM organization.project_team WHERE project_id = $1 ORDER BY team_id`, [projectId])).map(
      (r: { team_id: string }) => r.team_id,
    );
  const history = () =>
    t.db.query(`SELECT event_type, new_value, author_id FROM history.history_event WHERE entity_id = $1 ORDER BY id`, [projectId]);

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    const a = await fx.user('Admin', { isAdmin: true });
    const m = await fx.user('Gestor');
    const l = await fx.user('Lider');
    const other = await fx.user('Gestor de outro');
    manager = m;
    teamA = await fx.team('Alfa', [{ userId: l.id, role: 'leader' }]);
    teamB = await fx.team('Beta', [{ userId: other.id, role: 'leader' }]);
    inactiveTeam = await fx.team('Antiga', []);
    await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [inactiveTeam]);
    projectId = await fx.project('Projeto sem equipas', { managers: [m.id] });
    await fx.project('Outro', { managers: [other.id] });
    for (const [k, u] of Object.entries({ admin: a, manager: m, leader: l, other })) tokens[k] = await t.token({ email: (u as { email: string }).email });
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA01.3, CA01.4 — o gestor associa uma equipa; passa a constar das equipas do projeto e fica no histórico', async () => {
    const res = await as('manager').post(`/api/projects/${projectId}/teams`, { teamId: teamA }).expect(201);
    expect(res.body).toEqual([{ id: teamA, name: expect.stringContaining('Alfa'), active: true }]);
    const list = await as('manager').get(`/api/projects/${projectId}/teams`).expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toEqual([teamA]);
    const project = await as('admin').get(`/api/projects/${projectId}`).expect(200);
    expect(project.body.teams.map((x: { id: string }) => x.id)).toEqual([teamA]);
    expect(await history()).toEqual([
      expect.objectContaining({ event_type: 'team_added', new_value: expect.objectContaining({ teamId: teamA }), author_id: manager.id }),
    ]);
  });

  it('CA01.3, RN23 — o líder da equipa associada passa a ver o projeto e a criar-lhe tarefas para a sua equipa', async () => {
    const objective = await request(t.server)
      .post(`/api/projects/${projectId}/objectives`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ title: 'Objetivo' })
      .expect(201);
    const epic = await request(t.server)
      .post(`/api/objectives/${objective.body.id}/epics`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ title: 'Épico' })
      .expect(201);
    await request(t.server)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ epicId: epic.body.id, teamId: teamA, title: 'Primeira tarefa da equipa' })
      .expect(201);
  });

  it('CA01.5 — associar de novo a mesma equipa é recusado (409) e mantém uma única associação', async () => {
    const res = await as('admin').post(`/api/projects/${projectId}/teams`, { teamId: teamA }).expect(409);
    expect(res.body.detail).toContain('já está associada');
    expect(await links()).toEqual([teamA]);
  });

  it('RN33 — equipa desativada ou inexistente → 422; id mal formado → 400; nada muda', async () => {
    await as('admin').post(`/api/projects/${projectId}/teams`, { teamId: inactiveTeam }).expect(422);
    await as('admin').post(`/api/projects/${projectId}/teams`, { teamId: randomUUID() }).expect(422);
    await as('admin').post(`/api/projects/${projectId}/teams`, { teamId: 'alfa' }).expect(400);
    await as('admin').post(`/api/projects/${projectId}/teams`, {}).expect(400);
    expect(await links()).toEqual([teamA]);
  });

  it('§3.1 — o líder e o gestor de outro projeto não associam equipas (403); projeto inexistente ou eliminado → 404', async () => {
    await as('leader').post(`/api/projects/${projectId}/teams`, { teamId: teamB }).expect(403);
    await as('other').post(`/api/projects/${projectId}/teams`, { teamId: teamB }).expect(403);
    expect(await links()).toEqual([teamA]);
    await as('admin').post(`/api/projects/${randomUUID()}/teams`, { teamId: teamB }).expect(404);
    const deleted = await fx.project('Eliminado', { deleted: true });
    await as('admin').post(`/api/projects/${deleted}/teams`, { teamId: teamB }).expect(404);
    // O administrador associa a segunda equipa: as duas, ordenadas pelo nome.
    const res = await as('admin').post(`/api/projects/${projectId}/teams`, { teamId: teamB }).expect(201);
    expect(res.body.map((x: { id: string }) => x.id)).toEqual([teamA, teamB]);
  });
});
