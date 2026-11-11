import request from 'supertest';
import type { QueryRunner } from 'typeorm';
import { Fixtures, TestApp } from './support/test-app';

/**
 * Ligações à base dentro das transações (docs/verification.md §7): uma leitura de outro módulo feita com o
 * DataSource enquanto a transação está aberta ocupa uma segunda ligação do pool. Com pedidos de escrita em
 * simultâneo perto do tamanho do pool (10), todos ficam à espera de uma ligação que nenhum liberta.
 */
describe('Ligações do pool dentro das transações', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, sprintId: string, taskId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
    };
  };

  /** Ligações pedidas ao pool enquanto outra ligação tem uma transação aberta, durante `run`. */
  const extraConnections = async (run: () => Promise<unknown>) => {
    const open = new Set<QueryRunner>();
    let extra = 0;
    const original = t.db.createQueryRunner.bind(t.db);
    const spy = jest.spyOn(t.db, 'createQueryRunner').mockImplementation((mode) => {
      if ([...open].some((r) => r.isTransactionActive && !r.isReleased)) extra++;
      const runner = original(mode);
      open.add(runner);
      return runner;
    });
    try {
      await run();
    } finally {
      spy.mockRestore();
    }
    return extra;
  };

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const k of ['leaderA', 'memberA']) {
      const u = await fx.user(k);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Pool', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
    ]);
    const projectId = await fx.project('Pool', { teams: [teamA] });
    const epicId = await fx.epic(await fx.objective(projectId));
    taskId = await fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA });
    [{ id: sprintId }] = await t.db.query(
      `INSERT INTO planning.sprint (team_id, start_date, end_date) VALUES ($1, '2030-03-04', '2030-03-15') RETURNING id`,
      [teamA],
    );
  });

  afterAll(() => t.close());

  it('ajustar a disponibilidade lê o papel na equipa dentro da transação', async () => {
    const extra = await extraConnections(() =>
      as('leaderA').put(`/api/sprints/${sprintId}/availability/${ids.memberA}`, { availableHours: 40 }).expect(200),
    );
    expect(extra).toBe(0);
  });

  it('criar uma sprint lê o estado da equipa dentro da transação', async () => {
    const extra = await extraConnections(() =>
      as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-04-01', endDate: '2030-04-12' }).expect(201),
    );
    expect(extra).toBe(0);
  });

  it('acrescentar um participante lê o papel na equipa dentro da transação', async () => {
    const extra = await extraConnections(() => as('leaderA').post(`/api/tasks/${taskId}/participants`, { userId: ids.memberA }).expect(201));
    expect(extra).toBe(0);
  });
});
