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
      const page = await reader.list('task', t1, 1, 20);
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
      const [closedInTask] = (await reader.list('task', t1, 1, 20)).items.filter((e) => e.eventType === 'closed');
      expect(closedInTask).toMatchObject({ entityId: sprintId, author: { id: SYSTEM_AUTHOR_ID, name: 'Sistema' } });
      expect(closedInTask.newValue).toEqual({ status: 'closed', returnedToBacklog: [t1] });
      const sprint = await reader.list('sprint', sprintId, 1, 20);
      expect(summary(sprint.items)).toEqual(['sprint:created', 'sprint:task_planned', 'sprint:task_planned', 'sprint:started', 'sprint:closed']);
      expect(sprint.items[4].newValue?.returnedToBacklog).toEqual(expect.arrayContaining([t1, t2]));
    });

    it('RN32: cada evento traz o autor com nome e os nomes das pessoas, equipas e tarefas referidas', async () => {
      const sprint = await reader.list('sprint', sprintId, 1, 20);
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
      const all = (await reader.list('task', t1, 1, 20)).items.map((e) => e.id);
      const second = await reader.list('task', t1, 2, 2);
      expect(second).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(second.items.map((e) => e.id)).toEqual(all.slice(2, 4));
    });

    it('RN32: os outros elementos mostram só os seus eventos', async () => {
      const criterionEvents = await t.db.query(`SELECT count(*)::int AS n FROM history.history_event WHERE entity_id = $1`, [criterionId]);
      expect(criterionEvents[0].n).toBe(2);
      expect((await reader.list('team', teamId, 1, 20)).total).toBe(0);
      expect((await reader.list('task', t2, 1, 20)).items.map((e) => e.eventType)).toEqual(['task_planned', 'closed']);
    });
  });
});
