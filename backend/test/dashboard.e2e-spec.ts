import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I8 — Painel inicial (Ficha PL 03, Ex. 7): CA07.9, RF36, CAT06, RN38; contagens sem subtarefas (regra do
 * contrato confirmada no Ex. 1) e sobre todas as tarefas do projeto, não uma página.
 */
describe('I8 — painel inicial', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  type Role = 'admin' | 'manager' | 'leaderA' | 'memberA' | 'leaderB' | 'loner';
  const users = {} as Record<Role, U>;
  const tokens = {} as Record<Role, string>;
  let teamA: string;
  let projectAB: string, projectB: string, projectManaged: string;

  const dashboard = (role: Role) => request(t.server).get('/api/dashboard').set('Authorization', `Bearer ${tokens[role]}`);
  const byId = (body: { projects: { id: string }[] }) => new Map(body.projects.map((p) => [p.id, p]));

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    users.admin = await fx.user('Admin', { isAdmin: true });
    users.manager = await fx.user('Gestor');
    users.leaderA = await fx.user('Lider A');
    users.memberA = await fx.user('Membro A');
    users.leaderB = await fx.user('Lider B');
    users.loner = await fx.user('Sem projetos');
    teamA = await fx.team('Equipa A', [
      { userId: users.leaderA.id, role: 'leader' },
      { userId: users.memberA.id, role: 'member' },
    ]);
    const teamB = await fx.team('Equipa B', [{ userId: users.leaderB.id, role: 'leader' }]);
    await fx.team('Equipa sem projetos', [{ userId: users.loner.id, role: 'leader' }]);
    projectAB = await fx.project('Alfa e Beta', { teams: [teamA, teamB] });
    projectB = await fx.project('Só Beta', { teams: [teamB] });
    projectManaged = await fx.project('Gerido sem equipas', { managers: [users.manager.id] });
    await fx.project('Eliminado', { teams: [teamA], deleted: true });

    const epic = await fx.epic(await fx.objective(projectAB));
    const task = (state: string) => fx.task({ epicId: epic, teamId: teamA, createdBy: users.leaderA.id, state });
    await task('in_planning');
    await task('in_planning');
    const developing = await task('in_development');
    await task('done');
    // Subtarefas e tarefas eliminadas não contam.
    await fx.task({ parentTaskId: developing, teamId: teamA, createdBy: users.leaderA.id, state: 'in_planning' });
    const deleted = await task('in_testing');
    await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [deleted]);
    for (const role of Object.keys(users) as Role[]) tokens[role] = await t.token({ email: users[role].email });
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA07.9, CAT06 — o membro vê os projetos da sua equipa, ordenados pelo nome, com as contagens por estado e o total', async () => {
    const res = await dashboard('memberA').expect(200);
    expect(res.body.projects.map((p: { name: string }) => p.name)).toEqual(['Alfa e Beta']);
    expect(res.body.projects[0]).toEqual({
      id: projectAB,
      name: 'Alfa e Beta',
      taskCounts: {
        in_planning: 2,
        in_technical_analysis: 0,
        ready_for_development: 0,
        in_development: 1,
        in_testing: 0,
        done: 1,
        delivered: 0,
      },
      totalTasks: 4,
    });
  });

  it('CAT06 — cada papel vê os seus projetos: líder de outra equipa, gestor sem equipas, administrador; projeto eliminado nunca (RN38)', async () => {
    const leaderB = byId((await dashboard('leaderB').expect(200)).body);
    expect([...leaderB.keys()]).toEqual([projectAB, projectB]);
    expect(leaderB.get(projectB)).toMatchObject({ totalTasks: 0, taskCounts: expect.objectContaining({ in_planning: 0, delivered: 0 }) });

    const manager = (await dashboard('manager').expect(200)).body;
    expect(manager.projects.map((p: { id: string }) => p.id)).toEqual([projectManaged]);

    const admin = byId((await dashboard('admin').expect(200)).body);
    expect(admin.has(projectAB) && admin.has(projectB) && admin.has(projectManaged)).toBe(true);
    expect([...admin.values()].some((p) => (p as unknown as { name: string }).name === 'Eliminado')).toBe(false);
  });

  it('CA07.9 — sem projetos visíveis, a lista vem vazia', async () => {
    const res = await dashboard('loner').expect(200);
    expect(res.body).toEqual({ projects: [] });
  });

  it('Ex. 7 — as contagens acompanham as alterações: criar, mudar o estado e eliminar uma tarefa', async () => {
    const before = byId((await dashboard('leaderA').expect(200)).body).get(projectAB) as unknown as { totalTasks: number; taskCounts: Record<string, number> };
    const epic = (await t.db.query(`SELECT e.id FROM work.epic e JOIN work.objective o ON o.id = e.objective_id WHERE o.project_id = $1`, [projectAB]))[0].id;
    const created = await request(t.server)
      .post(`/api/projects/${projectAB}/tasks`)
      .set('Authorization', `Bearer ${tokens.leaderA}`)
      .send({ epicId: epic, teamId: teamA, title: 'Nova para o painel' })
      .expect(201);
    let after = byId((await dashboard('leaderA').expect(200)).body).get(projectAB) as unknown as typeof before;
    expect(after.totalTasks).toBe(before.totalTasks + 1);
    expect(after.taskCounts.in_planning).toBe(before.taskCounts.in_planning + 1);

    await request(t.server)
      .post(`/api/tasks/${created.body.id}/state`)
      .set('Authorization', `Bearer ${tokens.leaderA}`)
      .send({ state: 'in_technical_analysis' })
      .expect(200);
    after = byId((await dashboard('leaderA').expect(200)).body).get(projectAB) as unknown as typeof before;
    expect(after.taskCounts.in_planning).toBe(before.taskCounts.in_planning);
    expect(after.taskCounts.in_technical_analysis).toBe(before.taskCounts.in_technical_analysis + 1);

    await request(t.server).delete(`/api/tasks/${created.body.id}`).set('Authorization', `Bearer ${tokens.leaderA}`).expect(204);
    after = byId((await dashboard('leaderA').expect(200)).body).get(projectAB) as unknown as typeof before;
    expect(after).toEqual(before);
  });

  it('CAT01, CAT02 — sem token → 401; token sem conta na Matriz → 403', async () => {
    await request(t.server).get('/api/dashboard').expect(401);
    const noAccount = await t.token({ email: 'ninguem@matriz.example' });
    await request(t.server).get('/api/dashboard').set('Authorization', `Bearer ${noAccount}`).expect(403);
  });
});
