import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { OrganizationReader } from '../src/modules/organization/organization-reader.service';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I3, passo 2 — Equipas e pertenças: CA01.1, CA01.7–CA01.12; RN06, RN21, RN33, RN34; §3.1. Decisões do
 * humano (F18): pertenças por conjunto completo do utilizador (soma 100); a soma conta só as equipas
 * ativas; a desativação mantém as pertenças e não há reativação.
 */
describe('I3 — equipas e pertenças', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  const tokens: Record<string, string> = {};
  let admin: U, manager: U, leader: U, member: U, loner: U, inactive: U;
  let teamA: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
    };
  };
  const uniqueName = (base: string) => `${base} ${randomUUID().slice(0, 6)}`;
  const memberships = async (userId: string) =>
    (await t.db.query(
      `SELECT team_id, role, allocation_pct FROM organization.team_membership WHERE user_id = $1 ORDER BY team_id`,
      [userId],
    )) as { team_id: string; role: string; allocation_pct: number }[];
  const teamRow = async (id: string) =>
    (await t.db.query(`SELECT name, active, deactivated_at FROM organization.team WHERE id = $1`, [id]))[0];
  const history = (id: string) =>
    t.db.query(`SELECT event_type, old_value, new_value, author_id FROM history.history_event WHERE entity_id = $1 ORDER BY id`, [id]);
  const teamCount = async () => (await t.db.query(`SELECT count(*)::int AS n FROM organization.team`))[0].n as number;

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    admin = await fx.user('Admin', { isAdmin: true });
    manager = await fx.user('Gestor');
    leader = await fx.user('Lider');
    member = await fx.user('Membro');
    loner = await fx.user('Sem equipa');
    inactive = await fx.user('Inativo', { active: false });
    teamA = await fx.team('Equipa A', [
      { userId: leader.id, role: 'leader' },
      { userId: member.id, role: 'member' },
    ]);
    await fx.project('Projeto', { managers: [manager.id], teams: [teamA] });
    for (const [k, u] of Object.entries({ admin, manager, leader, member, loner })) tokens[k] = await t.token({ email: u.email });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Criar e consultar equipas', () => {
    it('CA01.1, RN34 — o administrador cria uma equipa com um líder sem outras equipas (100 %); fica na lista e no histórico', async () => {
      const name = uniqueName('Equipa Nova');
      const res = await as('admin')
        .post('/api/teams', { name: `  ${name}  `, leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] })
        .expect(201);
      expect(res.body).toMatchObject({
        name,
        active: true,
        deactivatedAt: null,
        openTaskCount: 0,
        members: [{ user: { id: loner.id, name: 'Sem equipa' }, role: 'leader', allocationPct: 100, activeTotal: 100 }],
      });
      const list = await as('member').get('/api/teams').expect(200);
      expect(list.body).toEqual(expect.arrayContaining([{ id: res.body.id, name, active: true }]));
      expect((await history(res.body.id)).map((e: { event_type: string }) => e.event_type)).toEqual(['created', 'member_added']);
      // Para os testes seguintes, o líder volta a não ter equipas.
      await t.db.query(`DELETE FROM organization.team_membership WHERE user_id = $1`, [loner.id]);
    });

    it('CA01.1, RN06 (F18) — líder que já tem outra equipa: indica as alocações em todas, a somar 100; as atuais ajustam-se', async () => {
      const res = await as('admin')
        .post('/api/teams', {
          name: uniqueName('Equipa Dupla'),
          leaderId: member.id,
          leaderAllocationPct: 40,
          leaderOtherAllocations: [{ teamId: teamA, allocationPct: 60 }],
        })
        .expect(201);
      expect(await memberships(member.id)).toEqual(
        expect.arrayContaining([
          { team_id: teamA, role: 'member', allocation_pct: 60 },
          { team_id: res.body.id, role: 'leader', allocation_pct: 40 },
        ]),
      );
      expect((await history(teamA)).pop()).toEqual(
        expect.objectContaining({ event_type: 'member_updated', old_value: { userId: member.id, allocationPct: 100 }, new_value: { userId: member.id, allocationPct: 60 } }),
      );
      // Repor: o membro só na equipa A, a 100 %.
      await as('admin').put(`/api/users/${member.id}/memberships`, { memberships: [{ teamId: teamA, role: 'member', allocationPct: 100 }] }).expect(409);
      await t.db.query(`DELETE FROM organization.team_membership WHERE team_id = $1`, [res.body.id]);
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [res.body.id]);
      await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 100 WHERE user_id = $1 AND team_id = $2`, [member.id, teamA]);
    });

    it('CA01.1, RN06 — alocações que não somam 100 ou que não correspondem às equipas do líder → 422; nada criado', async () => {
      const before = await teamCount();
      const name = uniqueName('Equipa Errada');
      await as('admin').post('/api/teams', { name, leaderId: leader.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(422);
      await as('admin')
        .post('/api/teams', { name, leaderId: leader.id, leaderAllocationPct: 50, leaderOtherAllocations: [{ teamId: teamA, allocationPct: 40 }] })
        .expect(422);
      await as('admin')
        .post('/api/teams', { name, leaderId: loner.id, leaderAllocationPct: 50, leaderOtherAllocations: [{ teamId: teamA, allocationPct: 50 }] })
        .expect(422);
      await as('admin').post('/api/teams', { name, leaderId: inactive.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(422);
      await as('admin').post('/api/teams', { name, leaderId: randomUUID(), leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(422);
      expect(await teamCount()).toBe(before);
      expect(await memberships(leader.id)).toEqual([{ team_id: teamA, role: 'leader', allocation_pct: 100 }]);
    });

    it('CA01.1, RN33, EC01.1 — nome repetido entre as ativas (sem distinguir maiúsculas) → 409; nome vazio ou longo → 400', async () => {
      const name = uniqueName('Equipa Única');
      const first = await as('admin').post('/api/teams', { name, leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(201);
      await t.db.query(`DELETE FROM organization.team_membership WHERE user_id = $1`, [loner.id]);
      const before = await teamCount();
      const res = await as('admin')
        .post('/api/teams', { name: name.toUpperCase(), leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] })
        .expect(409);
      expect(res.body.detail).toContain('Já existe');
      for (const bad of ['', '   ', 'n'.repeat(101)]) {
        await as('admin').post('/api/teams', { name: bad, leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(400);
      }
      await as('admin').post('/api/teams', { name: 'Sem líder' }).expect(400);
      expect(await teamCount()).toBe(before);
      expect(await memberships(loner.id)).toEqual([]);
      // Uma equipa desativada não bloqueia o nome.
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [first.body.id]);
      await as('admin').post('/api/teams', { name, leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(201);
      await t.db.query(`DELETE FROM organization.team_membership WHERE user_id = $1`, [loner.id]);
    });

    it('CA01.7 — o administrador altera o nome; as associações mantêm-se; nome de outra equipa ativa → 409', async () => {
      const name = uniqueName('Renomeada');
      const res = await as('admin').patch(`/api/teams/${teamA}`, { name }).expect(200);
      expect(res.body).toMatchObject({ id: teamA, name, members: expect.arrayContaining([expect.objectContaining({ user: expect.objectContaining({ id: leader.id }) })]) });
      expect((await t.db.query(`SELECT count(*)::int AS n FROM organization.project_team WHERE team_id = $1`, [teamA]))[0].n).toBe(1);
      expect((await history(teamA)).pop()).toEqual(expect.objectContaining({ event_type: 'updated', new_value: { name } }));
      const other = await fx.team(uniqueName('Outra'), [{ userId: manager.id, role: 'leader' }]);
      const otherName = (await teamRow(other)).name;
      await as('admin').patch(`/api/teams/${teamA}`, { name: otherName.toLowerCase() }).expect(409);
      expect((await teamRow(teamA)).name).toBe(name);
      await t.db.query(`DELETE FROM organization.team_membership WHERE team_id = $1`, [other]);
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [other]);
    });

    it('§3.1 — só o administrador cria, altera, consulta o detalhe e desativa equipas (403); a listagem é para todos, sem as desativadas', async () => {
      const before = await teamCount();
      for (const who of ['manager', 'leader', 'member']) {
        await as(who).post('/api/teams', { name: 'X', leaderId: loner.id, leaderAllocationPct: 100, leaderOtherAllocations: [] }).expect(403);
        await as(who).patch(`/api/teams/${teamA}`, { name: 'X' }).expect(403);
        await as(who).get(`/api/teams/${teamA}`).expect(403);
        await as(who).post(`/api/teams/${teamA}/deactivate`).expect(403);
        await as(who).get(`/api/users/${member.id}/memberships`).expect(403);
        await as(who).put(`/api/users/${member.id}/memberships`, { memberships: [] }).expect(403);
      }
      expect(await teamCount()).toBe(before);
      const inactiveTeam = await fx.team(uniqueName('Desativada'), []);
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [inactiveTeam]);
      expect((await as('member').get('/api/teams').expect(200)).body.map((x: { id: string }) => x.id)).not.toContain(inactiveTeam);
      expect((await as('admin').get('/api/teams').expect(200)).body.map((x: { id: string }) => x.id)).toContain(inactiveTeam);
      await as('admin').get(`/api/teams/${randomUUID()}`).expect(404);
      await as('admin').get('/api/teams/nao-e-um-id').expect(404);
    });
  });

  describe('Pertenças', () => {
    it('CA01.9, RN06 — o administrador associa um utilizador a uma equipa com uma alocação; soma 100 noutra equipa', async () => {
      const teamB = await fx.team(uniqueName('Equipa B'), [{ userId: manager.id, role: 'leader' }]);
      const res = await as('admin')
        .put(`/api/users/${member.id}/memberships`, {
          memberships: [
            { teamId: teamA, role: 'member', allocationPct: 70 },
            { teamId: teamB, role: 'member', allocationPct: 30 },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({ userId: member.id, activeTotal: 100 });
      expect(res.body.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ teamId: teamB, role: 'member', allocationPct: 30, teamActive: true })]));
      const detail = await as('admin').get(`/api/teams/${teamB}`).expect(200);
      expect(detail.body.members).toEqual(expect.arrayContaining([{ user: { id: member.id, name: 'Membro' }, role: 'member', allocationPct: 30, activeTotal: 100 }]));
      expect((await history(teamB)).pop()).toEqual(
        expect.objectContaining({ event_type: 'member_added', new_value: { userId: member.id, role: 'member', allocationPct: 30 }, author_id: admin.id }),
      );
      // Sair da equipa B: volta a 100 % na A.
      await as('admin').put(`/api/users/${member.id}/memberships`, { memberships: [{ teamId: teamA, role: 'member', allocationPct: 100 }] }).expect(200);
      expect((await history(teamB)).pop()).toEqual(expect.objectContaining({ event_type: 'member_removed', new_value: null }));
    });

    it('RN06 (F18) — soma diferente de 100, equipa repetida, desativada ou inexistente, conta desativada → 422; nada muda', async () => {
      const before = await memberships(member.id);
      const put = (body: object, userId = member.id) => as('admin').put(`/api/users/${userId}/memberships`, body);
      await put({ memberships: [{ teamId: teamA, role: 'member', allocationPct: 90 }] }).expect(422);
      await put({ memberships: [{ teamId: teamA, role: 'member', allocationPct: 50 }, { teamId: teamA, role: 'member', allocationPct: 50 }] }).expect(422);
      await put({ memberships: [{ teamId: randomUUID(), role: 'member', allocationPct: 100 }] }).expect(422);
      const off = await fx.team(uniqueName('Desligada'), []);
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [off]);
      await put({ memberships: [{ teamId: off, role: 'member', allocationPct: 100 }] }).expect(422);
      await put({ memberships: [{ teamId: teamA, role: 'member', allocationPct: 100 }] }, inactive.id).expect(422);
      await put({ memberships: [{ teamId: teamA, role: 'chefe', allocationPct: 100 }] }).expect(400);
      await put({ memberships: [{ teamId: teamA, role: 'member', allocationPct: 0 }] }).expect(400);
      await put({ memberships: [{ teamId: teamA, role: 'member', allocationPct: 100.5 }] }).expect(400);
      await put({}).expect(400);
      await as('admin').put(`/api/users/${randomUUID()}/memberships`, { memberships: [] }).expect(404);
      expect(await memberships(member.id)).toEqual(before);
    });

    it('CA01.12, RN34 — retirar ou despromover o único líder de uma equipa ativa → 409; com outro líder, é permitido', async () => {
      const lead = await fx.user('Lider unico');
      const team = await fx.team(uniqueName('Um líder'), [{ userId: lead.id, role: 'leader' }]);
      await as('admin').put(`/api/users/${lead.id}/memberships`, { memberships: [] }).expect(409);
      const res = await as('admin').put(`/api/users/${lead.id}/memberships`, { memberships: [{ teamId: team, role: 'member', allocationPct: 100 }] }).expect(409);
      expect(res.body.detail).toContain('sem líder');
      expect(await memberships(lead.id)).toEqual([{ team_id: team, role: 'leader', allocation_pct: 100 }]);
      // Outro líder: agora pode sair.
      await as('admin').put(`/api/users/${loner.id}/memberships`, { memberships: [{ teamId: team, role: 'leader', allocationPct: 100 }] }).expect(200);
      await as('admin').put(`/api/users/${lead.id}/memberships`, { memberships: [] }).expect(200);
      expect(await memberships(lead.id)).toEqual([]);
      await t.db.query(`DELETE FROM organization.team_membership WHERE user_id = $1`, [loner.id]);
    });
  });

  describe('Desativar equipas', () => {
    it('CA01.10, RN33 — com tarefas por concluir (subtarefas incluídas), a desativação é recusada (409) e a equipa continua ativa', async () => {
      const lead = await fx.user('Lider ocupado');
      const team = await fx.team(uniqueName('Ocupada'), [{ userId: lead.id, role: 'leader' }]);
      const project = await fx.project(uniqueName('Projeto ocupado'), { teams: [team] });
      const epic = await fx.epic(await fx.objective(project));
      const parent = await fx.task({ epicId: epic, teamId: team, createdBy: lead.id, state: 'done' });
      await fx.task({ parentTaskId: parent, teamId: team, createdBy: lead.id, state: 'in_development' });
      const res = await as('admin').post(`/api/teams/${team}/deactivate`).expect(409);
      expect(res.body.detail).toContain('1 tarefa');
      expect((await as('admin').get(`/api/teams/${team}`).expect(200)).body).toMatchObject({ active: true, openTaskCount: 1 });
      expect((await teamRow(team)).active).toBe(true);
    });

    it('CA01.10, RN33 — uma tarefa criada para a equipa enquanto ela é desativada conta: a desativação espera por ela e é recusada (409)', async () => {
      const lead = await fx.user('Lider concorrente');
      const team = await fx.team(uniqueName('Concorrida'), [{ userId: lead.id, role: 'leader' }]);
      const project = await fx.project(uniqueName('Projeto concorrido'), { teams: [team] });
      const epic = await fx.epic(await fx.objective(project));
      // A criação da tarefa (TasksService.create), com a transação ainda aberta.
      const creating = t.db.createQueryRunner();
      try {
        await creating.connect();
        await creating.startTransaction();
        expect(await t.app.get(OrganizationReader).isActiveTeamOfProject(team, project, creating.manager)).toBe(true);
        await creating.query(
          `INSERT INTO work.task (epic_id, title, team_id, original_team_id, created_by) VALUES ($1, 'Criada em paralelo', $2, $2, $3)`,
          [epic, team, lead.id],
        );
        let settled = false;
        const deactivation = as('admin')
          .post(`/api/teams/${team}/deactivate`)
          .then((res) => {
            settled = true;
            return res;
          });
        // A desativação fica à espera da criação; sem o trinco, terminaria logo, sem ver a tarefa.
        for (let i = 0; !settled; i++) {
          const [{ n }] = await t.db.query(
            `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
          );
          if (n > 0) break;
          if (i === 250) throw new Error('A desativação nunca ficou à espera nem terminou.');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await creating.commitTransaction();
        expect((await deactivation).status).toBe(409);
      } finally {
        if (creating.isTransactionActive) await creating.rollbackTransaction();
        await creating.release();
      }
      expect((await teamRow(team)).active).toBe(true);
    });

    it('CA01.11, F18 — sem tarefas por concluir, a equipa é desativada: deixa de receber tarefas, mantém pertenças e histórico; os membros ficam por realocar', async () => {
      const lead = await fx.user('Lider de saída');
      const other = await fx.team(uniqueName('Fica'), [{ userId: lead.id, role: 'member' }]);
      const team = await fx.team(uniqueName('Sai'), [{ userId: lead.id, role: 'leader' }]);
      await t.db.query(`UPDATE organization.team_membership SET allocation_pct = 50 WHERE user_id = $1`, [lead.id]);
      const project = await fx.project(uniqueName('Projeto da equipa'), { teams: [team, other] });
      const epic = await fx.epic(await fx.objective(project));
      await fx.task({ epicId: epic, teamId: team, createdBy: lead.id, state: 'delivered' });
      // Uma tarefa por concluir num projeto eliminado e outra eliminada não contam (RN38).
      const deletedProject = await fx.project(uniqueName('Eliminado'), { teams: [team], deleted: true });
      await fx.task({ epicId: await fx.epic(await fx.objective(deletedProject)), teamId: team, createdBy: lead.id });
      const gone = await fx.task({ epicId: epic, teamId: team, createdBy: lead.id });
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [gone]);

      const res = await as('admin').post(`/api/teams/${team}/deactivate`).expect(200);
      expect(res.body).toMatchObject({ active: false, deactivatedAt: expect.any(String), openTaskCount: 0 });
      expect(res.body.members).toEqual([expect.objectContaining({ user: expect.objectContaining({ id: lead.id }), activeTotal: 50 })]);
      expect((await history(team)).pop()).toEqual(expect.objectContaining({ event_type: 'deactivated', author_id: admin.id }));
      const mine = await as('admin').get(`/api/users/${lead.id}/memberships`).expect(200);
      expect(mine.body).toMatchObject({ activeTotal: 50 });
      expect(mine.body.memberships).toEqual(expect.arrayContaining([expect.objectContaining({ teamId: team, teamActive: false })]));
      // Deixa de receber tarefas (RN33) e não há reativação.
      const adminToken = tokens.admin;
      await request(t.server)
        .post(`/api/projects/${project}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ epicId: epic, teamId: team, title: 'Para a equipa desativada' })
        .expect(422);
      await as('admin').post(`/api/teams/${team}/deactivate`).expect(409);
      // Realocar o membro: a equipa desativada não se toca.
      await as('admin').put(`/api/users/${lead.id}/memberships`, { memberships: [{ teamId: other, role: 'leader', allocationPct: 100 }] }).expect(200);
      expect(await memberships(lead.id)).toEqual(expect.arrayContaining([{ team_id: team, role: 'leader', allocation_pct: 50 }, { team_id: other, role: 'leader', allocation_pct: 100 }]));
    });
  });
});
