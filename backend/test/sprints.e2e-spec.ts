import request from 'supertest';
import { SYSTEM_AUTHOR_ID } from '../src/shared/events/domain-events';
import { SprintJobService } from '../src/modules/planning/sprint-job.service';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I9 — Backlog e sprints: US04 CA04.1–CA04.16; US08 CA08.1, CA08.3, CA08.4; RN04, RN05, RN08, RN10, RN27,
 * RN31, RN36, RN37; §3.1. Decisões do humano (F19): fim do dia em Europe/Lisbon; autor «Sistema» com um
 * identificador reservado; CA08.2 no I11. As datas usam 2030 para não dependerem do dia de hoje.
 */
describe('I9 — backlog e sprints', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, teamB: string, epicId: string, otherEpic: string, projectId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) =>
    fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, estimateHours: 8, storyPoints: 3, ...opts });
  const sprintHistory = (sprintId: string) =>
    t.db.query(`SELECT event_type, old_value, new_value, author_id FROM history.history_event WHERE entity_id = $1 ORDER BY id`, [sprintId]);
  const links = (sprintId: string) =>
    t.db.query(`SELECT task_id, left_reason FROM planning.sprint_task WHERE sprint_id = $1 ORDER BY task_id`, [sprintId]);
  const sprintCount = async () => (await t.db.query(`SELECT count(*)::int AS n FROM planning.sprint`))[0].n as number;
  let year = 2030;
  /** Um período novo em cada teste, para as sprints não se sobreporem entre testes. */
  const period = (days = 14) => {
    year++;
    const end = new Date(Date.UTC(year, 0, days));
    return { startDate: `${year}-01-01`, endDate: end.toISOString().slice(0, 10) };
  };
  const newSprint = async (dates = period()) => (await as('leaderA').post(`/api/teams/${teamA}/sprints`, dates).expect(201)).body.id as string;
  const backlogIds = async (who = 'leaderA') =>
    (await as(who).get(`/api/teams/${teamA}/backlog?pageSize=100`).expect(200)).body.items.map((i: { id: string }) => i.id);

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, manager: {}, leaderA: {}, memberA: {}, leaderB: {}, outsider: {} })) {
      const u = await fx.user(k, opts);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
    ]);
    teamB = await fx.team('Beta', [{ userId: ids.leaderB, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA, teamB] });
    epicId = await fx.epic(await fx.objective(projectId));
    otherEpic = await fx.epic(await fx.objective(await fx.project('Outro', { teams: [teamA] })));
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Sprints', () => {
    it('CA04.1, RN36 — o líder cria uma sprint «Planeada» da sua equipa, com os dias úteis; fica no histórico', async () => {
      const res = await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-01-07', endDate: '2030-01-18' }).expect(201);
      expect(res.body).toMatchObject({ teamId: teamA, startDate: '2030-01-07', endDate: '2030-01-18', status: 'planned', workingDays: 10, startedAt: null, tasks: [], leftTasks: [] });
      expect(await sprintHistory(res.body.id)).toEqual([expect.objectContaining({ event_type: 'created', author_id: ids.leaderA })]);
      const list = await as('memberA').get(`/api/teams/${teamA}/sprints`).expect(200);
      expect(list.body.map((s: { id: string }) => s.id)).toContain(res.body.id);
    });

    it('RN31, CA04.8 — início depois do fim → 400; sobreposição com outra sprint da equipa → 409; outra equipa e datas contíguas podem', async () => {
      const before = await sprintCount();
      await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-02-10', endDate: '2030-02-01' }).expect(400);
      await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-02-30', endDate: '2030-03-01' }).expect(400);
      await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-01-18', endDate: '2030-01-25' }).expect(409);
      const res = await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-01-01', endDate: '2030-01-31' }).expect(409);
      expect(res.body.detail).toContain('sobrepõem');
      expect(await sprintCount()).toBe(before);
      await as('leaderA').post(`/api/teams/${teamA}/sprints`, { startDate: '2030-01-19', endDate: '2030-01-25' }).expect(201);
      await as('leaderB').post(`/api/teams/${teamB}/sprints`, { startDate: '2030-01-07', endDate: '2030-01-18' }).expect(201);
    });

    it('§3.1, RN36 — o membro, o administrador, o gestor e o líder de outra equipa não criam sprints (403); consultar: membros, administrador e gestores dos projetos da equipa', async () => {
      const before = await sprintCount();
      for (const who of ['memberA', 'admin', 'manager', 'leaderB']) {
        await as(who).post(`/api/teams/${teamA}/sprints`, period()).expect(403);
      }
      expect(await sprintCount()).toBe(before);
      await as('admin').get(`/api/teams/${teamA}/sprints`).expect(200);
      await as('admin').get(`/api/teams/${teamA}/backlog`).expect(200);
      await as('outsider').get(`/api/teams/${teamA}/sprints`).expect(403);
      // F20 (I10): o gestor de um projeto em que a equipa participa consulta o planeamento, só em leitura.
      await as('manager').get(`/api/teams/${teamA}/backlog`).expect(200);
      await as('leaderA').get('/api/teams/00000000-0000-4000-8000-000000000000/sprints').expect(404);
      await as('leaderA').get('/api/sprints/00000000-0000-4000-8000-000000000000').expect(404);
      const off = await fx.team('Desligada', [{ userId: ids.leaderA, role: 'leader' }]);
      await t.db.query(`UPDATE organization.team SET active = false WHERE id = $1`, [off]);
      await as('leaderA').post(`/api/teams/${off}/sprints`, period()).expect(403);
    });

    it('CA04.12, CA04.13, RN36 — o líder altera as datas de uma sprint «Planeada» (histórico); numa ativa → 409 e mantêm-se', async () => {
      const sprintId = await newSprint();
      const next = period();
      const res = await as('leaderA').patch(`/api/sprints/${sprintId}`, next).expect(200);
      expect(res.body).toMatchObject(next);
      expect((await sprintHistory(sprintId)).pop()).toEqual(expect.objectContaining({ event_type: 'dates_changed', new_value: next }));
      await as('memberA').patch(`/api/sprints/${sprintId}`, period()).expect(403);
      await as('leaderA').post(`/api/sprints/${sprintId}/start`).expect(200);
      await as('leaderA').patch(`/api/sprints/${sprintId}`, period()).expect(409);
      expect((await as('leaderA').get(`/api/sprints/${sprintId}`).expect(200)).body).toMatchObject(next);
      await t.db.query(`UPDATE planning.sprint SET status = 'closed', closed_at = now() WHERE id = $1`, [sprintId]);
    });
  });

  describe('Backlog e planeamento', () => {
    it('CA04.2, CA08.1, CA08.4 — o membro cria uma tarefa da sua equipa: fica no backlog e não entra numa sprint', async () => {
      const created = await as('memberA')
        .post(`/api/projects/${projectId}/tasks`, {
          epicId,
          teamId: teamA,
          title: 'Proposta do membro',
          estimateHours: 4,
        })
        .expect(201);
      const backlog = await as('memberA').get(`/api/teams/${teamA}/backlog?pageSize=100`).expect(200);
      expect(backlog.body.items.find((i: { id: string }) => i.id === created.body.id)).toMatchObject({ plannedSprintId: null, plannable: true, estimateHours: 4 });
      expect((await t.db.query(`SELECT count(*)::int AS n FROM planning.sprint_task WHERE task_id = $1`, [created.body.id]))[0].n).toBe(0);
      // CA08.3: o pedido de criação não aceita uma sprint.
      const field = await as('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Direto na sprint', sprintId: created.body.id }).expect(400);
      expect(JSON.stringify(field.body)).toContain('sprintId');
    });

    it('CA04.3 — o líder planeia uma tarefa numa sprint «Planeada»: fica nela e continua no backlog, assinalada', async () => {
      const sprintId = await newSprint();
      const taskId = await task({ title: 'Planeável' });
      const res = await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId }).expect(201);
      expect(res.body.tasks).toEqual([expect.objectContaining({ id: taskId, addedAfterStart: false, startEstimateHours: null, leftAt: null })]);
      const backlog = await as('leaderA').get(`/api/teams/${teamA}/backlog?pageSize=100`).expect(200);
      expect(backlog.body.items.find((i: { id: string }) => i.id === taskId)).toMatchObject({ plannedSprintId: sprintId });
      expect((await sprintHistory(sprintId)).pop()).toEqual(expect.objectContaining({ event_type: 'task_planned', new_value: expect.objectContaining({ taskId }) }));
    });

    it('CA04.7, RN27 — sem estimativa temporal → 422; concluída, de outra equipa ou eliminada → 422; já planeada → 409; nada muda', async () => {
      const sprintId = await newSprint();
      const other = await newSprint();
      const noEstimate = await task({ estimateHours: undefined, title: 'Sem estimativa' });
      await t.db.query(`UPDATE work.task SET estimate_hours = NULL WHERE id = $1`, [noEstimate]);
      const res = await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: noEstimate }).expect(422);
      expect(res.body.detail).toContain('estimativa temporal');
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: await task({ state: 'done' }) }).expect(422);
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: await task({ teamId: teamB, createdBy: ids.leaderB }) }).expect(422);
      const deleted = await task();
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [deleted]);
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: deleted }).expect(422);
      const once = await task();
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: once }).expect(201);
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: once }).expect(409);
      await as('leaderA').post(`/api/sprints/${other}/tasks`, { taskId: once }).expect(409);
      expect(await links(sprintId)).toEqual([{ task_id: once, left_reason: null }]);
      expect(await links(other)).toEqual([]);
      expect((await as('leaderA').get(`/api/teams/${teamA}/backlog?pageSize=100`).expect(200)).body.items.find((i: { id: string }) => i.id === noEstimate)).toMatchObject({ plannable: false });
    });

    it('CA04.6, CA08.3, RN08 — o membro (e o administrador) não planeiam nem retiram tarefas (403); a tarefa fica onde estava', async () => {
      const sprintId = await newSprint();
      const planned = await task();
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: planned }).expect(201);
      const loose = await task();
      for (const who of ['memberA', 'admin', 'manager']) {
        await as(who).post(`/api/sprints/${sprintId}/tasks`, { taskId: loose }).expect(403);
        await as(who).delete(`/api/sprints/${sprintId}/tasks/${planned}`).expect(403);
      }
      expect(await links(sprintId)).toEqual([{ task_id: planned, left_reason: null }]);
    });

    it('CA04.14 — retirar de uma sprint «Planeada»: deixa de estar planeada e continua no backlog', async () => {
      const sprintId = await newSprint();
      const taskId = await task();
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId }).expect(201);
      const res = await as('leaderA').delete(`/api/sprints/${sprintId}/tasks/${taskId}`).expect(200);
      expect(res.body).toMatchObject({ tasks: [], leftTasks: [] });
      expect(await links(sprintId)).toEqual([]);
      expect(await backlogIds()).toContain(taskId);
      await as('leaderA').delete(`/api/sprints/${sprintId}/tasks/${taskId}`).expect(404);
    });
  });

  describe('Início, sprint ativa e fim', () => {
    it('CA04.9, CA04.5, RN05, RN10 — o administrador inicia, ajustando as datas: só as planeadas entram, com as estimativas desse momento; histórico', async () => {
      const sprintId = await newSprint();
      const planned = await task({ estimateHours: 10, storyPoints: 5, title: 'Planeada' });
      const notPlanned = await task({ title: 'Fica no backlog' });
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: planned }).expect(201);
      const dates = period(10);
      const res = await as('admin').post(`/api/sprints/${sprintId}/start`, dates).expect(200);
      expect(res.body).toMatchObject({ status: 'active', ...dates, startedAt: expect.any(String) });
      expect(res.body.tasks).toEqual([expect.objectContaining({ id: planned, startEstimateHours: 10, startStoryPoints: 5, addedAfterStart: false })]);
      const backlog = await backlogIds();
      expect(backlog).toContain(notPlanned);
      expect(backlog).not.toContain(planned);
      expect((await sprintHistory(sprintId)).pop()).toEqual(
        expect.objectContaining({ event_type: 'started', author_id: ids.admin, new_value: expect.objectContaining({ status: 'active', ...dates, taskIds: [planned] }) }),
      );
      ids.activeSprint = sprintId;
    });

    it('CA04.10, CA04.11, RN31 — o gestor e o membro não iniciam (403); com uma sprint ativa, outra não inicia (409); data de fim passada → 422', async () => {
      const sprintId = await newSprint();
      await as('manager').post(`/api/sprints/${sprintId}/start`).expect(403);
      await as('memberA').post(`/api/sprints/${sprintId}/start`).expect(403);
      const res = await as('leaderA').post(`/api/sprints/${sprintId}/start`).expect(409);
      expect(res.body.detail).toContain('sprint ativa');
      expect((await as('leaderA').get(`/api/sprints/${sprintId}`).expect(200)).body.status).toBe('planned');
      const other = await (async () => {
        const r = await as('leaderB').post(`/api/teams/${teamB}/sprints`, { startDate: '2020-01-06', endDate: '2020-01-17' }).expect(201);
        return r.body.id as string;
      })();
      await as('leaderB').post(`/api/sprints/${other}/start`).expect(422);
      await as('leaderB').post(`/api/sprints/${other}/start`, { startDate: '2030-01-01', endDate: '2029-01-01' }).expect(400);
    });

    it('CA04.16, RN37 — acrescentar a uma sprint ativa: passa a fazer parte dela, assinalada, com a estimativa desse momento; sai do backlog', async () => {
      const taskId = await task({ estimateHours: 6, title: 'Acrescentada' });
      const res = await as('leaderA').post(`/api/sprints/${ids.activeSprint}/tasks`, { taskId }).expect(201);
      expect(res.body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId, addedAfterStart: true, startEstimateHours: 6 })]));
      expect(await backlogIds()).not.toContain(taskId);
      expect((await sprintHistory(ids.activeSprint)).pop()).toEqual(expect.objectContaining({ event_type: 'task_added' }));
      ids.added = taskId;
    });

    it('CA04.15, RN37 — retirar de uma sprint ativa: volta ao backlog, fica registado e continua a contar como planeada no início; pode voltar', async () => {
      const planned = (await as('leaderA').get(`/api/sprints/${ids.activeSprint}`).expect(200)).body.tasks.find((x: { addedAfterStart: boolean }) => !x.addedAfterStart).id;
      const res = await as('leaderA').delete(`/api/sprints/${ids.activeSprint}/tasks/${planned}`).expect(200);
      expect(res.body.leftTasks).toEqual([expect.objectContaining({ id: planned, leftReason: 'removed', startEstimateHours: 10, leftAt: expect.any(String) })]);
      expect(await backlogIds()).toContain(planned);
      expect((await sprintHistory(ids.activeSprint)).pop()).toEqual(expect.objectContaining({ event_type: 'task_removed', author_id: ids.leaderA }));
      // Volta à mesma sprint: a linha reativa-se, com a estimativa do início e sem passar a «acrescentada».
      const back = await as('leaderA').post(`/api/sprints/${ids.activeSprint}/tasks`, { taskId: planned }).expect(201);
      expect(back.body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: planned, addedAfterStart: false, startEstimateHours: 10, leftAt: null })]));
      expect(back.body.leftTasks).toEqual([]);
    });

    it('CA04.4, RN04, RN36 — a tarefa diária termina a sprint depois da data de fim: as não concluídas voltam ao backlog com tudo; as concluídas ficam', async () => {
      const job = t.app.get(SprintJobService);
      const sprint = (await as('leaderA').get(`/api/sprints/${ids.activeSprint}`).expect(200)).body;
      const finished = (await as('leaderA').get(`/api/sprints/${ids.activeSprint}`).expect(200)).body.tasks[0].id as string;
      await t.db.query(`UPDATE work.task SET state = 'done', assignee_id = $2 WHERE id = $1`, [finished, ids.memberA]);
      await t.db.query(`UPDATE work.task SET state = 'in_testing', assignee_id = $2 WHERE id = $1`, [ids.added, ids.memberA]);
      // Antes do fim, a sprint não termina (o próprio dia de fim ainda conta). Outras sprints da base de testes
      // (de outros ficheiros, que partilham a base) podem terminar: a tarefa diária é global.
      expect(await job.runOnce(sprint.endDate)).not.toContain(ids.activeSprint);
      expect((await as('leaderA').get(`/api/sprints/${ids.activeSprint}`).expect(200)).body.status).toBe('active');
      const dayAfter = new Date(`${sprint.endDate}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      const closed = await job.runOnce(dayAfter.toISOString().slice(0, 10));
      expect(closed).toContain(ids.activeSprint);
      const after = (await as('leaderA').get(`/api/sprints/${ids.activeSprint}`).expect(200)).body;
      expect(after).toMatchObject({ status: 'closed', closedAt: expect.any(String) });
      expect(after.tasks.map((x: { id: string }) => x.id)).toEqual([finished]);
      expect(after.leftTasks).toEqual([expect.objectContaining({ id: ids.added, leftReason: 'sprint_ended', state: 'in_testing', estimateHours: 6, assignee: expect.objectContaining({ id: ids.memberA }) })]);
      expect(await backlogIds()).toContain(ids.added);
      expect((await sprintHistory(ids.activeSprint)).pop()).toEqual(
        expect.objectContaining({ event_type: 'closed', author_id: SYSTEM_AUTHOR_ID, new_value: { status: 'closed', returnedToBacklog: [ids.added] } }),
      );
      // Idempotente; a sprint terminada não recebe nem perde tarefas (409).
      expect(await job.runOnce(dayAfter.toISOString().slice(0, 10))).not.toContain(ids.activeSprint);
      await as('leaderA').post(`/api/sprints/${ids.activeSprint}/tasks`, { taskId: await task() }).expect(409);
      await as('leaderA').delete(`/api/sprints/${ids.activeSprint}/tasks/${finished}`).expect(409);
      await as('leaderA').post(`/api/sprints/${ids.activeSprint}/start`).expect(409);
    });

    it('DT13 — com o trinco da tarefa diária tomado por outra instância, a execução não faz nada', async () => {
      const job = t.app.get(SprintJobService);
      const runner = t.db.createQueryRunner();
      await runner.connect();
      try {
        await runner.query(`SELECT pg_advisory_lock(4271901)`);
        expect(await job.runOnce('2099-01-01')).toBeNull();
      } finally {
        await runner.query(`SELECT pg_advisory_unlock(4271901)`);
        await runner.release();
      }
    });

    it('RN38 — uma tarefa eliminada deixa de aparecer no backlog e nas sprints; tarefas de outros projetos da equipa aparecem', async () => {
      const sprintId = await newSprint();
      const gone = await task();
      const elsewhere = await task({ epicId: otherEpic, title: 'Noutro projeto' });
      await as('leaderA').post(`/api/sprints/${sprintId}/tasks`, { taskId: gone }).expect(201);
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [gone]);
      expect((await as('leaderA').get(`/api/sprints/${sprintId}`).expect(200)).body.tasks).toEqual([]);
      const backlog = await backlogIds();
      expect(backlog).not.toContain(gone);
      expect(backlog).toContain(elsewhere);
    });
  });
});
