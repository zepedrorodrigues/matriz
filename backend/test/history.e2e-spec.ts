import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { HistoryReader } from '../src/modules/history/history.reader';
import { SprintJobService } from '../src/modules/planning/sprint-job.service';
import { SYSTEM_AUTHOR_ID } from '../src/shared/events/domain-events';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I13 — Consulta do histórico (D50, `i13-historico-analise.md` §10): RN32, SEC04, CAT04.
 */
describe('I13 — histórico', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('CAT04 / SEC04 — só de acrescento na base de dados (S1)', () => {
    let eventId: string;

    beforeAll(async () => {
      const [row] = await t.db.query(
        `INSERT INTO history.history_event (entity_type, entity_id, event_type, new_value, author_id)
         VALUES ('task', $1, 'created', '{"title":"original"}', $2) RETURNING id`,
        [randomUUID(), SYSTEM_AUTHOR_ID],
      );
      eventId = row.id;
    });

    /** Corre a instrução numa transação sempre revertida: se o privilégio voltar, nada do histórico se perde. */
    const attempt = async (sql: string, params: unknown[] = []): Promise<unknown> => {
      const runner = t.db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(sql, params);
        return null;
      } catch (error) {
        return error;
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };

    it.each([
      ['UPDATE', `UPDATE history.history_event SET new_value = '{"title":"alterado"}' WHERE id = $1`, true],
      ['DELETE', `DELETE FROM history.history_event WHERE id = $1`, true],
      ['TRUNCATE', `TRUNCATE history.history_event`, false],
    ])('CAT04: %s como o role da aplicação falha com «permission denied»', async (_name, sql, withId) => {
      const error = await attempt(sql, withId ? [eventId] : []);
      expect(String((error as Error | null)?.message)).toMatch(/permission denied for table history_event/);
    });

    it('CAT04: o evento mantém-se e o INSERT e o SELECT continuam permitidos', async () => {
      const [row] = await t.db.query(`SELECT new_value FROM history.history_event WHERE id = $1`, [eventId]);
      expect(row.new_value).toEqual({ title: 'original' });
      expect(await attempt(`INSERT INTO history.history_event (entity_type, entity_id, event_type, author_id) VALUES ('task', $1, 'x', $2)`, [randomUUID(), SYSTEM_AUTHOR_ID])).toBeNull();
    });
  });

  /**
   * Passo 3 — leitura (HistoryReader), sem rotas nem permissões (passo 4). Os eventos vêm dos fluxos reais
   * (API e tarefa diária): se um módulo mudar o nome de `taskId` ou de `returnedToBacklog`, estes testes falham.
   */
  describe('CAT03 — leitura do histórico', () => {
    let reader: HistoryReader;
    let leader: { id: string; email: string; name: string };
    let teamId: string;
    let t1: string;
    let t2: string;
    let sprintId: string;
    let criterionId: string;
    const as = async (u: { email: string }) => {
      const token = await t.token({ email: u.email });
      const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
      return {
        post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
        patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      };
    };
    /** O líder da equipa vê tudo: estes testes são da leitura, não dos filtros (passo 4). */
    const viewer = () => ({ id: leader.id, isAdmin: false });
    const summary = (items: { entityType: string; eventType: string }[]) => items.map((e) => `${e.entityType}:${e.eventType}`);

    beforeAll(async () => {
      reader = t.app.get(HistoryReader);
      const fx = new Fixtures(t.db);
      leader = await fx.user('Lider');
      teamId = await fx.team('Histórico', [{ userId: leader.id, role: 'leader' }]);
      const epicId = await fx.epic(await fx.objective(await fx.project('Projeto do histórico', { teams: [teamId] })));
      t1 = await fx.task({ epicId, teamId, createdBy: leader.id, title: 'Tarefa um', estimateHours: 5 });
      t2 = await fx.task({ epicId, teamId, createdBy: leader.id, title: 'Tarefa dois', estimateHours: 3 });

      const api = await as(leader);
      await api.patch(`/api/tasks/${t1}`, { title: 'Tarefa um, revista' }).expect(200);
      criterionId = (await api.post(`/api/tasks/${t1}/acceptance-criteria`, { description: 'Critério' }).expect(201)).body.id;
      await api.patch(`/api/tasks/${t1}/acceptance-criteria/${criterionId}`, { isMet: true }).expect(200);
      sprintId = (await api.post(`/api/teams/${teamId}/sprints`, { startDate: '2041-03-04', endDate: '2041-03-15' }).expect(201)).body.id;
      await api.post(`/api/sprints/${sprintId}/tasks`, { taskId: t1 }).expect(201);
      await api.post(`/api/sprints/${sprintId}/tasks`, { taskId: t2 }).expect(201);
      await api.post(`/api/sprints/${sprintId}/start`).expect(200);
      expect(await t.app.get(SprintJobService).runOnce('2041-03-16')).toContain(sprintId);
    });

    it('CAT03: a tarefa junta os seus eventos, os dos critérios e as entradas e saídas de sprints, por ordem de registo', async () => {
      const page = await reader.list('task', t1, 1, 20, viewer());
      expect(summary(page.items)).toEqual([
        'task:updated',
        'acceptance_criterion:created',
        'acceptance_criterion:criterion_changed',
        'sprint:task_planned',
        'sprint:closed',
      ]);
      expect(page.total).toBe(5);
      const ids = page.items.map((e) => BigInt(e.id));
      expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : 1)));
      // Só as entradas desta tarefa: o planeamento da outra tarefa e o início da sprint não aparecem.
      expect(page.items.filter((e) => e.eventType === 'task_planned').map((e) => e.newValue?.taskId)).toEqual([t1]);
    });

    it('CAT03: no fim da sprint, a tarefa vê só a sua devolução ao backlog; a sprint vê a lista inteira', async () => {
      const [closedInTask] = (await reader.list('task', t1, 1, 20, viewer())).items.filter((e) => e.eventType === 'closed');
      expect(closedInTask).toMatchObject({ entityId: sprintId, author: { id: SYSTEM_AUTHOR_ID, name: 'Sistema' } });
      expect(closedInTask.newValue).toEqual({ status: 'closed', returnedToBacklog: [t1] });
      const sprint = await reader.list('sprint', sprintId, 1, 20, viewer());
      expect(summary(sprint.items)).toEqual(['sprint:created', 'sprint:task_planned', 'sprint:task_planned', 'sprint:started', 'sprint:closed']);
      expect(sprint.items[4].newValue?.returnedToBacklog).toEqual(expect.arrayContaining([t1, t2]));
    });

    it('RN32: cada evento traz o autor com nome e os nomes das pessoas, equipas e tarefas referidas', async () => {
      const sprint = await reader.list('sprint', sprintId, 1, 20, viewer());
      expect(sprint.items[0]).toMatchObject({
        eventType: 'created',
        author: { id: leader.id, name: leader.name },
        references: { [teamId]: expect.stringContaining('Histórico') },
        omitted: [],
        occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(sprint.items[1].references).toEqual({ [t1]: 'Tarefa um, revista' });
    });

    it('D46: paginado como os comentários, com o total do conjunto', async () => {
      const all = (await reader.list('task', t1, 1, 20, viewer())).items.map((e) => e.id);
      const second = await reader.list('task', t1, 2, 2, viewer());
      expect(second).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(second.items.map((e) => e.id)).toEqual(all.slice(2, 4));
    });

    it('RN32: os outros elementos mostram só os seus eventos', async () => {
      const criterionEvents = await t.db.query(`SELECT count(*)::int AS n FROM history.history_event WHERE entity_id = $1`, [criterionId]);
      expect(criterionEvents[0].n).toBe(2);
      expect((await reader.list('team', teamId, 1, 20, viewer())).total).toBe(0);
      expect((await reader.list('task', t2, 1, 20, viewer())).items.map((e) => e.eventType)).toEqual(['task_planned', 'closed']);
    });
  });

  /**
   * Passo 4 — rotas, permissões e filtros (D50, requirements.md §3.1). Cada regra tem um teste que falha sem ela.
   */
  describe('D50 — quem consulta e o que vê', () => {
    type Who = 'admin' | 'manager' | 'leaderA' | 'memberA' | 'memberA2' | 'crossAssignee' | 'leaderB' | 'outsider';
    const u = {} as Record<Who, { id: string; email: string; name: string }>;
    const tokens = {} as Record<Who, string>;
    let teamA: string;
    let projectId: string;
    let objectiveId: string;
    let epicId: string;
    let taskId: string;
    let hiddenTask: string;
    let goneTask: string;
    let goneProject: string;
    let goneObjective: string;
    let goneEpic: string;
    let sprintId: string;
    const http = (who: Who) => {
      const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
      return {
        get: (url: string) => auth(request(t.server).get(url)),
        post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
        put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
        del: (url: string) => auth(request(t.server).delete(url)),
      };
    };
    type Item = {
      eventType: string;
      oldValue: Record<string, unknown> | null;
      newValue: Record<string, unknown> | null;
      references: Record<string, string>;
      omitted: string[];
    };
    const items = async (who: Who, url: string): Promise<Item[]> => (await http(who).get(url).expect(200)).body.items;

    beforeAll(async () => {
      const fx = new Fixtures(t.db);
      for (const who of ['admin', 'manager', 'leaderA', 'memberA', 'memberA2', 'crossAssignee', 'leaderB', 'outsider'] as Who[]) {
        u[who] = await fx.user(who, { isAdmin: who === 'admin' });
        tokens[who] = await t.token({ email: u[who].email });
      }
      teamA = await fx.team('Alfa', [{ userId: u.leaderA.id, role: 'leader' }]);
      const teamB = await fx.team('Beta', [
        { userId: u.leaderB.id, role: 'leader' },
        { userId: u.crossAssignee.id, role: 'member' },
      ]);
      // Pertenças pela API: ficam no histórico da equipa com a alocação (SEC07).
      // As pertenças de cada pessoa somam 100 (F18).
      await http('admin')
        .put(`/api/users/${u.memberA.id}/memberships`, {
          memberships: [
            { teamId: teamA, role: 'member', allocationPct: 60 },
            { teamId: teamB, role: 'member', allocationPct: 40 },
          ],
        })
        .expect(200);
      await http('admin').put(`/api/users/${u.memberA2.id}/memberships`, { memberships: [{ teamId: teamA, role: 'member', allocationPct: 100 }] }).expect(200);

      projectId = await fx.project('Projeto gerido', { managers: [u.manager.id], teams: [teamA, teamB] });
      objectiveId = await fx.objective(projectId);
      epicId = await fx.epic(objectiveId);
      // O gestor não vê este projeto (CAT06); a equipa Alfa, sim.
      const hiddenEpic = await fx.epic(await fx.objective(await fx.project('Projeto escondido', { teams: [teamA] })));
      taskId = await fx.task({ epicId, teamId: teamA, createdBy: u.leaderA.id, title: 'Visível', estimateHours: 4 });
      hiddenTask = await fx.task({ epicId: hiddenEpic, teamId: teamA, createdBy: u.leaderA.id, title: 'Escondida', estimateHours: 2 });
      await t.db.query(`UPDATE work.task SET assignee_id = $2, assignee_cross_team = true WHERE id = $1`, [taskId, u.crossAssignee.id]);
      await http('leaderA').post(`/api/tasks/${taskId}/acceptance-criteria`, { description: 'Critério' }).expect(201);

      sprintId = (await http('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2042-05-05', endDate: '2042-05-16' }).expect(201)).body.id;
      await http('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId }).expect(201);
      await http('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: hiddenTask }).expect(201);
      await http('leaderA').put(`/api/sprints/${sprintId}/availability/${u.memberA.id}`, { availableHours: 30 }).expect(200);
      await http('leaderA').put(`/api/sprints/${sprintId}/availability/${u.memberA2.id}`, { availableHours: 20 }).expect(200);

      goneTask = await fx.task({ epicId, teamId: teamA, createdBy: u.leaderA.id, title: 'Eliminada' });
      await http('admin').del(`/api/tasks/${goneTask}`).expect(204);
      goneProject = await fx.project('Projeto eliminado', { managers: [u.manager.id], teams: [teamA] });
      goneObjective = await fx.objective(goneProject);
      goneEpic = await fx.epic(goneObjective);
      await http('admin').del(`/api/projects/${goneProject}`).expect(204);
    });

    it('Z1, CA09.2: quem vê a tarefa consulta o histórico; o responsável de outra equipa vê a tarefa mas recebe 403 (RN03)', async () => {
      for (const who of ['admin', 'manager', 'leaderA', 'memberA'] as Who[]) {
        expect((await items(who, `/api/tasks/${taskId}/history`)).map((e) => e.eventType)).toEqual(['created', 'task_planned']);
      }
      await http('crossAssignee').get(`/api/tasks/${taskId}`).expect(200);
      await http('crossAssignee').get(`/api/tasks/${taskId}/history`).expect(403);
      await http('outsider').get(`/api/tasks/${taskId}/history`).expect(403);
    });

    it('D50 3a: o histórico do projeto, do objetivo e do épico segue a visibilidade do projeto (CAT06)', async () => {
      for (const url of [`/api/projects/${projectId}/history`, `/api/objectives/${objectiveId}/history`, `/api/epics/${epicId}/history`]) {
        await http('memberA').get(url).expect(200);
        await http('manager').get(url).expect(200);
        await http('outsider').get(url).expect(403);
      }
      await http('memberA').get(`/api/epics/${randomUUID()}/history`).expect(404);
      await http('memberA').get(`/api/objectives/x/history`).expect(404);
    });

    it('D50 3b, SEC07: na equipa, o líder e o administrador veem as alocações; o membro só a sua; o gestor nenhuma', async () => {
      const allocations = async (who: Who) =>
        (await items(who, `/api/teams/${teamA}/history`))
          .filter((e) => e.eventType === 'member_added')
          .map((e) => [e.newValue?.userId, e.newValue?.allocationPct ?? null, e.omitted]);
      const full = [
        [u.memberA.id, 60, []],
        [u.memberA2.id, 100, []],
      ];
      expect(await allocations('leaderA')).toEqual(full);
      expect(await allocations('admin')).toEqual(full);
      expect(await allocations('memberA')).toEqual([
        [u.memberA.id, 60, []],
        [u.memberA2.id, null, ['allocationPct']],
      ]);
      expect(await allocations('manager')).toEqual([
        [u.memberA.id, null, ['allocationPct']],
        [u.memberA2.id, null, ['allocationPct']],
      ]);
      await http('outsider').get(`/api/teams/${teamA}/history`).expect(403);
      await http('leaderB').get(`/api/teams/${teamA}/history`).expect(403);
    });

    it('D50 3b, SEC07: na sprint, as horas disponíveis seguem a mesma regra', async () => {
      const hours = async (who: Who) =>
        (await items(who, `/api/sprints/${sprintId}/history`))
          .filter((e) => e.eventType === 'availability_adjusted')
          .map((e) => e.newValue?.availableHours ?? null);
      expect(await hours('leaderA')).toEqual([30, 20]);
      expect(await hours('memberA')).toEqual([30, null]);
      expect(await hours('manager')).toEqual([null, null]);
    });

    it('D50 3b, CAT06: na sprint, a tarefa de um projeto que não se vê sai do evento, com os dados dela e o nome', async () => {
      const planned = async (who: Who) => (await items(who, `/api/sprints/${sprintId}/history`)).filter((e) => e.eventType === 'task_planned');
      const manager = await planned('manager');
      expect(manager.map((e) => e.newValue?.taskId ?? null)).toEqual([taskId, null]);
      expect(manager[1].newValue).toEqual({});
      expect(manager[1].omitted).toEqual(['taskId', 'estimateHours', 'storyPoints']);
      expect(Object.values(manager[1].references)).not.toContain('Escondida');
      expect((await planned('memberA')).map((e) => e.newValue?.taskId)).toEqual([taskId, hiddenTask]);
      await http('outsider').get(`/api/sprints/${sprintId}/history`).expect(403);
    });

    it('D50 4, RN38: o histórico de um elemento eliminado só o administrador o consulta (200); os outros recebem 404', async () => {
      expect((await items('admin', `/api/tasks/${goneTask}/history`)).map((e) => e.eventType)).toEqual(['deleted']);
      await http('leaderA').get(`/api/tasks/${goneTask}/history`).expect(404);
      expect((await items('admin', `/api/projects/${goneProject}/history`)).map((e) => e.eventType)).toEqual(['deleted']);
      for (const url of [`/api/projects/${goneProject}/history`, `/api/objectives/${goneObjective}/history`, `/api/epics/${goneEpic}/history`]) {
        await http('admin').get(url).expect(200);
        await http('manager').get(url).expect(404);
      }
    });

    it('D46: a paginação é validada como nos comentários', async () => {
      await http('memberA').get(`/api/tasks/${taskId}/history?pageSize=101`).expect(400);
      expect((await http('memberA').get(`/api/tasks/${taskId}/history?pageSize=1&page=2`).expect(200)).body).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    });
  });

  /** Passo 5 — critérios de aceitação que dependem da consulta (i13-historico-analise.md §1). */
  describe('Critérios de aceitação', () => {
    /** Um token por pessoa: a conta liga-se ao `sub` do primeiro acesso (RN35), e um `sub` novo seria recusado. */
    const tokens = new Map<string, string>();
    const as = async (who: { email: string }) => {
      if (!tokens.has(who.email)) tokens.set(who.email, await t.token({ email: who.email }));
      const token = tokens.get(who.email)!;
      return (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    };

    it('CA01.11: depois de desativada, o histórico da equipa continua consultável pelo líder, pelos membros e pelo administrador', async () => {
      const fx = new Fixtures(t.db);
      const [admin, leader, member] = [await fx.user('admin', { isAdmin: true }), await fx.user('lider'), await fx.user('membro')];
      const teamId = await fx.team('A desativar', [{ userId: leader.id, role: 'leader' }]);
      const asAdmin = await as(admin);
      await asAdmin(request(t.server).put(`/api/users/${member.id}/memberships`))
        .send({ memberships: [{ teamId, role: 'member', allocationPct: 100 }] })
        .expect(200);
      await asAdmin(request(t.server).patch(`/api/teams/${teamId}`)).send({ name: `Renomeada ${randomUUID().slice(0, 8)}` }).expect(200);
      await asAdmin(request(t.server).post(`/api/teams/${teamId}/deactivate`)).expect(200);
      for (const who of [admin, leader, member]) {
        const res = await (await as(who))(request(t.server).get(`/api/teams/${teamId}/history`));
        expect({ who: who.name, status: res.status, events: res.body.items?.map((e: { eventType: string }) => e.eventType) }).toEqual({
          who: who.name,
          status: 200,
          events: ['member_added', 'updated', 'deactivated'],
        });
        // SEC07: o membro continua a ver a sua alocação, como antes de a equipa ser desativada.
        expect(res.body.items[0]).toMatchObject({ newValue: { userId: member.id, allocationPct: 100 }, omitted: [] });
      }
      // O planeamento da equipa desativada continua fechado aos membros (só o histórico mudou).
      await (await as(member))(request(t.server).get(`/api/teams/${teamId}/sprints`)).expect(403);
    });

    type Event = {
      eventType: string;
      oldValue: Record<string, unknown> | null;
      newValue: Record<string, unknown> | null;
      author: { id: string; name: string };
      occurredAt: string;
      references: Record<string, string>;
    };
    const taskHistory = async (who: { email: string }, taskId: string): Promise<Event[]> =>
      (await (await as(who))(request(t.server).get(`/api/tasks/${taskId}/history`)).expect(200)).body.items;

    it('CA06.6, CA09.2, RN32: na tarefa transferida identificam-se o responsável anterior, a equipa original e cada passagem, por ordem', async () => {
      const fx = new Fixtures(t.db);
      const [manager, leaderA, memberA, leaderB] = [await fx.user('gestor'), await fx.user('liderA'), await fx.user('membroA'), await fx.user('liderB')];
      const teamA = await fx.team('Origem', [
        { userId: leaderA.id, role: 'leader' },
        { userId: memberA.id, role: 'member' },
      ]);
      const teamB = await fx.team('Destino', [{ userId: leaderB.id, role: 'leader' }]);
      const epicId = await fx.epic(await fx.objective(await fx.project('Transferências', { managers: [manager.id], teams: [teamA, teamB] })));
      const task = await fx.task({ epicId, teamId: teamA, createdBy: leaderA.id, assigneeId: memberA.id, title: 'A transferir' });
      const asManager = await as(manager);
      await asManager(request(t.server).post(`/api/tasks/${task}/transfer`)).send({ targetTeamId: teamB }).expect(200);
      await asManager(request(t.server).post(`/api/tasks/${task}/transfer`)).send({ targetTeamId: teamA }).expect(200);

      const items = await taskHistory(leaderA, task);
      const transfers = items.filter((e) => e.eventType === 'team_transferred');
      expect(transfers.map((e) => [e.oldValue?.teamId, e.newValue?.teamId, e.newValue?.originalTeamId])).toEqual([
        [teamA, teamB, teamA],
        [teamB, teamA, teamA],
      ]);
      expect(transfers[0]).toMatchObject({
        oldValue: { assigneeId: memberA.id },
        author: { id: manager.id, name: manager.name },
        references: { [teamA]: expect.stringContaining('Origem'), [teamB]: expect.stringContaining('Destino'), [memberA.id]: memberA.name },
      });
      // O responsável não pertence à equipa de destino: sai, e o histórico diz quem era (F22).
      expect(items.find((e) => e.eventType === 'assignee_changed')).toMatchObject({
        oldValue: { assigneeId: memberA.id },
        newValue: { assigneeId: null, reason: 'transferred' },
        references: { [memberA.id]: memberA.name },
      });
    });

    it('CA06.5: depois da reabertura, o histórico anterior continua consultável, por ordem', async () => {
      const fx = new Fixtures(t.db);
      const leader = await fx.user('lider');
      const teamId = await fx.team('Reabertura', [{ userId: leader.id, role: 'leader' }]);
      const epicId = await fx.epic(await fx.objective(await fx.project('Reabertura', { teams: [teamId] })));
      const task = await fx.task({ epicId, teamId, createdBy: leader.id, state: 'done' });
      const asLeader = await as(leader);
      await asLeader(request(t.server).post(`/api/tasks/${task}/state`)).send({ state: 'delivered' }).expect(200);
      await asLeader(request(t.server).post(`/api/tasks/${task}/state`)).send({ state: 'in_development' }).expect(200);
      expect((await taskHistory(leader, task)).map((e) => [e.eventType, e.oldValue?.state, e.newValue?.state])).toEqual([
        ['state_changed', 'done', 'delivered'],
        ['reopened', 'delivered', 'in_development'],
      ]);
    });

    it('CAT03: cada alteração da tarefa fica no histórico consultado, com o autor e a data/hora', async () => {
      const fx = new Fixtures(t.db);
      const [leader, member] = [await fx.user('lider'), await fx.user('membro')];
      const teamId = await fx.team('Alterações', [
        { userId: leader.id, role: 'leader' },
        { userId: member.id, role: 'member' },
      ]);
      const epicId = await fx.epic(await fx.objective(await fx.project('Alterações', { teams: [teamId] })));
      const task = await fx.task({ epicId, teamId, createdBy: leader.id });
      const asLeader = await as(leader);
      const started = Date.now();
      await asLeader(request(t.server).patch(`/api/tasks/${task}`)).send({ title: 'Título novo' }).expect(200);
      await asLeader(request(t.server).patch(`/api/tasks/${task}`)).send({ estimateHours: 8 }).expect(200);
      await asLeader(request(t.server).patch(`/api/tasks/${task}`)).send({ assigneeId: member.id }).expect(200);
      await asLeader(request(t.server).post(`/api/tasks/${task}/state`)).send({ state: 'in_technical_analysis' }).expect(200);
      await asLeader(request(t.server).post(`/api/tasks/${task}/acceptance-criteria`)).send({ description: 'Critério' }).expect(201);

      const items = await taskHistory(member, task);
      expect(items.map((e) => e.eventType)).toEqual(['updated', 'estimate_changed', 'assignee_changed', 'state_changed', 'created']);
      for (const e of items) {
        expect(e.author).toEqual({ id: leader.id, name: leader.name });
        expect(Date.parse(e.occurredAt)).toBeGreaterThanOrEqual(started - 5000);
      }
      expect(items[2]).toMatchObject({ newValue: { assigneeId: member.id }, references: { [member.id]: member.name } });
    });

    it('CAT04: a API não tem nenhuma operação que altere ou apague o histórico; ele mantém-se', async () => {
      const fx = new Fixtures(t.db);
      const leader = await fx.user('lider');
      const teamId = await fx.team('Imutável', [{ userId: leader.id, role: 'leader' }]);
      const epicId = await fx.epic(await fx.objective(await fx.project('Imutável', { teams: [teamId] })));
      const task = await fx.task({ epicId, teamId, createdBy: leader.id });
      const asLeader = await as(leader);
      await asLeader(request(t.server).patch(`/api/tasks/${task}`)).send({ title: 'Registado' }).expect(200);
      const before = await taskHistory(leader, task);
      const url = `/api/tasks/${task}/history`;
      for (const req of [request(t.server).put(url), request(t.server).patch(url), request(t.server).delete(url), request(t.server).post(url)]) {
        await asLeader(req).send({ eventType: 'falso' }).expect(404);
      }
      expect(await taskHistory(leader, task)).toEqual(before);
    });
  });
});
