import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I5 — Critérios e estimativas: US03 CA03.4, CA03.5, CA03.8–CA03.10 (RN07, RN10, RN22); US06 CA06.3,
 * CA06.4, CA06.7–CA06.10 (RN13, RN24, RN27); §3.1 (registar o cumprimento); decisões do humano de
 * 2026-11-05: conta o estado atual (1a), definem os critérios quem criou a tarefa e as lideranças (2a),
 * 422 na estimativa de uma tarefa com subtarefas (3a), 409 nos critérios de uma tarefa terminada (4a).
 */
describe('I5 — critérios e estimativas', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  type Role = 'admin' | 'manager' | 'leaderA' | 'memberA' | 'memberA2' | 'leaderB' | 'outsider';
  const users = {} as Record<Role, U>;
  const tokens = {} as Record<Role, string>;
  let teamA: string, teamB: string;
  let projectId: string, epicId: string;

  const api = (role: Role) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[role]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
    };
  };

  const estimates = async (id: string) => {
    const [r] = await t.db.query(`SELECT estimate_hours, story_points FROM work.task WHERE id = $1`, [id]);
    return { hours: r.estimate_hours === null ? null : Number(r.estimate_hours), points: r.story_points as number | null };
  };
  const criterionRow = async (id: string) => {
    const [r] = await t.db.query(
      `SELECT task_id, description, is_met, met_by, met_at, created_by FROM work.acceptance_criterion WHERE id = $1`,
      [id],
    );
    return r as { task_id: string; description: string; is_met: boolean; met_by: string | null; met_at: Date | null; created_by: string };
  };
  const criterionCount = async (taskId: string) =>
    (await t.db.query(`SELECT count(*)::int AS n FROM work.acceptance_criterion WHERE task_id = $1`, [taskId]))[0].n as number;
  const history = (id: string) =>
    t.db.query(
      `SELECT event_type, old_value, new_value, author_id, occurred_at FROM history.history_event WHERE entity_id = $1 ORDER BY id`,
      [id],
    );
  const newTask = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) =>
    fx.task({ epicId, teamId: teamA, createdBy: users.leaderA.id, ...opts });
  const criteriaUrl = (taskId: string) => `/api/tasks/${taskId}/acceptance-criteria`;

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    users.admin = await fx.user('Admin', { isAdmin: true });
    users.manager = await fx.user('Gestor');
    users.leaderA = await fx.user('Lider A');
    users.memberA = await fx.user('Membro A');
    users.memberA2 = await fx.user('Membro A2');
    users.leaderB = await fx.user('Lider B');
    users.outsider = await fx.user('Fora');
    teamA = await fx.team('Equipa A', [
      { userId: users.leaderA.id, role: 'leader' },
      { userId: users.memberA.id, role: 'member' },
      { userId: users.memberA2.id, role: 'member' },
    ]);
    teamB = await fx.team('Equipa B', [{ userId: users.leaderB.id, role: 'leader' }]);
    const teamC = await fx.team('Equipa C', [{ userId: users.outsider.id, role: 'leader' }]);
    projectId = await fx.project('Projeto dos critérios', { managers: [users.manager.id], teams: [teamA, teamB] });
    await fx.project('Outro projeto', { teams: [teamC] });
    epicId = await fx.epic(await fx.objective(projectId));
    for (const role of Object.keys(users) as Role[]) tokens[role] = await t.token({ email: users[role].email });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('US03 — estimativas', () => {
    it('CA03.4 — o líder cria uma tarefa com estimativa temporal e story points, registados como valores independentes', async () => {
      const res = await api('leaderA')
        .post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Com estimativas', estimateHours: 8.5, storyPoints: 5 })
        .expect(201);
      expect(res.body).toMatchObject({ estimateHours: 8.5, storyPoints: 5 });
      expect(await estimates(res.body.id)).toEqual({ hours: 8.5, points: 5 });
      expect((await history(res.body.id))[0].new_value).toMatchObject({ estimateHours: 8.5, storyPoints: 5 });
      // EC03.1, RN27: pode existir no backlog sem estimativas.
      const none = await api('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Sem estimativas' }).expect(201);
      expect(none.body).toMatchObject({ estimateHours: null, storyPoints: null });
    });

    it('CA03.4, §3.1 — o membro da equipa responsável define as duas estimativas antes de «A desenvolver»', async () => {
      const taskId = await newTask({ state: 'ready_for_development' });
      const res = await api('memberA').patch(`/api/tasks/${taskId}`, { estimateHours: 3, storyPoints: 2 }).expect(200);
      expect(res.body).toMatchObject({ estimateHours: 3, storyPoints: 2 });
      expect(await estimates(taskId)).toEqual({ hours: 3, points: 2 });
    });

    it('CA03.5, RN10 — alterar uma estimativa não altera a outra; cada alteração fica no histórico como estimate_changed', async () => {
      const taskId = await newTask({ estimateHours: 8, storyPoints: 5 });
      await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours: 12 }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 12, points: 5 });
      await api('leaderA').patch(`/api/tasks/${taskId}`, { storyPoints: 8 }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 12, points: 8 });
      await api('leaderA').patch(`/api/tasks/${taskId}`, { storyPoints: null }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 12, points: null });
      expect(await history(taskId)).toEqual([
        expect.objectContaining({ event_type: 'estimate_changed', old_value: { estimateHours: 8 }, new_value: { estimateHours: 12 }, author_id: users.leaderA.id }),
        expect.objectContaining({ event_type: 'estimate_changed', old_value: { storyPoints: 5 }, new_value: { storyPoints: 8 } }),
        expect.objectContaining({ event_type: 'estimate_changed', old_value: { storyPoints: 8 }, new_value: { storyPoints: null } }),
      ]);
      // O mesmo valor não gera evento; título e estimativa no mesmo pedido geram um evento de cada tipo.
      await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours: 12 }).expect(200);
      await api('leaderA').patch(`/api/tasks/${taskId}`, { title: 'Novo título', estimateHours: 13 }).expect(200);
      expect((await history(taskId)).slice(3).map((e: { event_type: string }) => e.event_type)).toEqual(['updated', 'estimate_changed']);
    });

    it('CA03.9, RN07, EC03.2 — story points fora da escala e horas inválidas são recusados (400) e a estimativa anterior mantém-se', async () => {
      const taskId = await newTask({ estimateHours: 8, storyPoints: 5 });
      for (const storyPoints of [0, 4, 34, -1, 2.5, '5']) {
        const res = await api('leaderA').patch(`/api/tasks/${taskId}`, { storyPoints }).expect(400);
        expect(res.body.errors[0].field).toBe('storyPoints');
      }
      for (const estimateHours of [-1, 10000, 1.234, '8']) {
        const res = await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours }).expect(400);
        expect(res.body.errors[0].field).toBe('estimateHours');
      }
      expect(await estimates(taskId)).toEqual({ hours: 8, points: 5 });
      expect(await history(taskId)).toEqual([]);
      const before = (await t.db.query(`SELECT count(*)::int AS n FROM work.task`))[0].n;
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Escala errada', storyPoints: 4 }).expect(400);
      expect((await t.db.query(`SELECT count(*)::int AS n FROM work.task`))[0].n).toBe(before);
      // Limites aceites: 0 e 9999,99 horas; todos os valores da escala.
      await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours: 0, storyPoints: 21 }).expect(200);
      await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours: 9999.99, storyPoints: 1 }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 9999.99, points: 1 });
    });

    it('CA03.10, RN10 — depois de «A desenvolver», o membro não altera as estimativas (403, sem alterações nem histórico)', async () => {
      for (const state of ['in_development', 'in_testing', 'done', 'delivered']) {
        const taskId = await newTask({ state, estimateHours: 8, storyPoints: 5, assigneeId: users.memberA.id });
        const res = await api('memberA').patch(`/api/tasks/${taskId}`, { estimateHours: 4 }).expect(403);
        expect(res.body.detail).toContain('A desenvolver');
        await api('memberA').patch(`/api/tasks/${taskId}`, { storyPoints: 3 }).expect(403);
        expect(await estimates(taskId)).toEqual({ hours: 8, points: 5 });
        expect(await history(taskId)).toEqual([]);
      }
    });

    it('CA03.10, RN10, §3.1 — depois de «A desenvolver», o líder, o gestor e o administrador alteram as estimativas', async () => {
      const taskId = await newTask({ state: 'in_development', estimateHours: 8, storyPoints: 5 });
      await api('leaderA').patch(`/api/tasks/${taskId}`, { estimateHours: 10 }).expect(200);
      await api('manager').patch(`/api/tasks/${taskId}`, { storyPoints: 8 }).expect(200);
      await api('admin').patch(`/api/tasks/${taskId}`, { estimateHours: 11 }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 11, points: 8 });
      expect((await history(taskId)).map((e: { author_id: string }) => e.author_id)).toEqual([
        users.leaderA.id,
        users.manager.id,
        users.admin.id,
      ]);
    });

    it('RN10 (decisão 1a) — conta o estado atual: depois de a tarefa recuar para «Pronto a desenvolver», o membro volta a alterar', async () => {
      const taskId = await newTask({ state: 'in_development', estimateHours: 8 });
      await api('memberA').patch(`/api/tasks/${taskId}`, { estimateHours: 6 }).expect(403);
      await api('leaderA').post(`/api/tasks/${taskId}/state`, { state: 'ready_for_development' }).expect(200);
      await api('memberA').patch(`/api/tasks/${taskId}`, { estimateHours: 6 }).expect(200);
      expect(await estimates(taskId)).toEqual({ hours: 6, points: null });
    });

    it('§3.1 — quem não é da equipa responsável nem gere o projeto não define estimativas (403)', async () => {
      const taskId = await newTask({ estimateHours: 8 });
      await api('leaderB').patch(`/api/tasks/${taskId}`, { estimateHours: 1 }).expect(403);
      await api('outsider').patch(`/api/tasks/${taskId}`, { estimateHours: 1 }).expect(403);
      expect(await estimates(taskId)).toEqual({ hours: 8, points: null });
    });

    it('CA03.8, RN22, EC03.4 — numa tarefa com subtarefas, as estimativas apresentadas são as somas das subtarefas, em separado', async () => {
      const parentId = await newTask({ title: 'Tarefa principal', estimateHours: 100, storyPoints: 21 });
      await newTask({ epicId: undefined, parentTaskId: parentId, estimateHours: 3, storyPoints: 2 });
      await newTask({ epicId: undefined, parentTaskId: parentId, estimateHours: 5.5, storyPoints: 3 });
      await newTask({ epicId: undefined, parentTaskId: parentId }); // sem estimativas
      const deleted = await newTask({ epicId: undefined, parentTaskId: parentId, estimateHours: 40, storyPoints: 13 });
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [deleted]);

      const res = await api('memberA').get(`/api/tasks/${parentId}`).expect(200);
      expect(res.body).toMatchObject({ estimateHours: 8.5, storyPoints: 5 });
      expect(res.body.subtasks.map((s: { estimateHours: number | null }) => s.estimateHours)).toEqual([3, 5.5, null]);
      const list = await api('memberA').get(`/api/projects/${projectId}/tasks?pageSize=100`).expect(200);
      expect(list.body.items.find((i: { id: string }) => i.id === parentId)).toMatchObject({ estimateHours: 8.5, storyPoints: 5, subtaskCount: 3 });
    });

    it('RN22 (decisão 3a) — a estimativa de uma tarefa com subtarefas não se define diretamente (422, sem alterações)', async () => {
      const parentId = await newTask({ estimateHours: 8 });
      await newTask({ epicId: undefined, parentTaskId: parentId, estimateHours: 2 });
      const res = await api('leaderA').patch(`/api/tasks/${parentId}`, { storyPoints: 8 }).expect(422);
      expect(res.body.detail).toContain('soma');
      await api('leaderA').patch(`/api/tasks/${parentId}`, { title: 'Também não muda', estimateHours: 1 }).expect(422);
      expect(await estimates(parentId)).toEqual({ hours: 8, points: null });
      expect(await history(parentId)).toEqual([]);
      // O título continua a poder ser editado.
      await api('leaderA').patch(`/api/tasks/${parentId}`, { title: 'Só o título' }).expect(200);
    });
  });

  describe('US06 — critérios de aceitação', () => {
    it('CA06.7, RN24 — quem criou a tarefa (um membro) define os critérios, cada um com o cumprimento por registar', async () => {
      const created = await api('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do membro' }).expect(201);
      const taskId = created.body.id;
      const res = await api('memberA').post(criteriaUrl(taskId), { description: '  Exporta em PDF  ' }).expect(201);
      expect(res.body).toEqual({ id: expect.any(String), description: 'Exporta em PDF', isMet: false, metBy: null, metAt: null });
      expect(await criterionRow(res.body.id)).toMatchObject({ task_id: taskId, is_met: false, created_by: users.memberA.id });
      const task = await api('memberA').get(`/api/tasks/${taskId}`).expect(200);
      expect(task.body.acceptanceCriteria).toEqual([res.body]);
      expect(await history(res.body.id)).toEqual([
        expect.objectContaining({
          event_type: 'created',
          old_value: null,
          new_value: { taskId, description: 'Exporta em PDF', isMet: false },
          author_id: users.memberA.id,
        }),
      ]);
    });

    it('RN24 (decisão 2a) — o líder, o gestor e o administrador definem critérios; outro membro e quem não é da equipa não (403, nada criado)', async () => {
      const taskId = await newTask({ createdBy: users.memberA.id });
      await api('memberA2').post(criteriaUrl(taskId), { description: 'Não é o criador' }).expect(403);
      await api('leaderB').post(criteriaUrl(taskId), { description: 'Outra equipa' }).expect(403);
      await api('outsider').post(criteriaUrl(taskId), { description: 'Sem acesso' }).expect(403);
      expect(await criterionCount(taskId)).toBe(0);
      for (const role of ['leaderA', 'manager', 'admin'] as const) {
        await api(role).post(criteriaUrl(taskId), { description: `Critério de ${role}` }).expect(201);
      }
      expect(await criterionCount(taskId)).toBe(3);
    });

    it('CA06.8, RN24 — depois de «A desenvolver», nem quem criou a tarefa (membro) altera os critérios (403, inalterados)', async () => {
      const taskId = await newTask({ createdBy: users.memberA.id, state: 'in_development', assigneeId: users.memberA.id });
      const criterionId = await fx.criterion(taskId, users.memberA.id);
      await api('memberA').post(criteriaUrl(taskId), { description: 'Novo' }).expect(403);
      const res = await api('memberA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { description: 'Alterado' }).expect(403);
      expect(res.body.detail).toContain('A desenvolver');
      expect(await criterionRow(criterionId)).toMatchObject({ description: 'Critério de teste', is_met: false });
      expect(await criterionCount(taskId)).toBe(1);
      expect(await history(criterionId)).toEqual([]);
    });

    it('CA06.9, RN24 — depois de «A desenvolver», o líder e o gestor alteram um critério; fica no histórico com autor e data/hora', async () => {
      const taskId = await newTask({ state: 'in_testing' });
      const criterionId = await fx.criterion(taskId, users.leaderA.id);
      const res = await api('leaderA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { description: 'Exporta em PDF e CSV' }).expect(200);
      expect(res.body).toMatchObject({ id: criterionId, description: 'Exporta em PDF e CSV', isMet: false });
      await api('manager').patch(`${criteriaUrl(taskId)}/${criterionId}`, { description: 'Exporta em PDF, CSV e XLSX' }).expect(200);
      await api('leaderA').post(criteriaUrl(taskId), { description: 'Acrescentado em testes' }).expect(201);
      const events = await history(criterionId);
      expect(events).toEqual([
        expect.objectContaining({
          event_type: 'criterion_changed',
          old_value: { description: 'Critério de teste' },
          new_value: { taskId, description: 'Exporta em PDF e CSV' },
          author_id: users.leaderA.id,
          occurred_at: expect.any(Date),
        }),
        expect.objectContaining({ event_type: 'criterion_changed', author_id: users.manager.id }),
      ]);
    });

    it('§3.1, RN24 — o membro regista o cumprimento só nas tarefas que lhe estão atribuídas; quem e quando vêm do token e do sistema', async () => {
      const taskId = await newTask({ state: 'in_development', assigneeId: users.memberA.id });
      const criterionId = await fx.criterion(taskId, users.leaderA.id);
      await api('memberA2').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: true }).expect(403);
      await api('leaderB').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: true }).expect(403);
      expect(await criterionRow(criterionId)).toMatchObject({ is_met: false, met_by: null });

      const met = await api('memberA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: true }).expect(200);
      expect(met.body).toMatchObject({ isMet: true, metBy: { id: users.memberA.id, name: 'Membro A' }, metAt: expect.any(String) });
      // Marcar de novo não muda quem registou nem gera evento.
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: true }).expect(200);
      expect(await criterionRow(criterionId)).toMatchObject({ is_met: true, met_by: users.memberA.id });
      const unmet = await api('memberA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: false }).expect(200);
      expect(unmet.body).toMatchObject({ isMet: false, metBy: null, metAt: null });
      expect((await history(criterionId)).map((e: { new_value: unknown }) => e.new_value)).toEqual([
        { taskId, isMet: true },
        { taskId, isMet: false },
      ]);
    });

    it('CA06.10, RN27 — sem critérios não passa a «Pronto a desenvolver»; com um critério criado pela API, passa', async () => {
      const taskId = await newTask({ state: 'in_technical_analysis' });
      await api('leaderA').post(`/api/tasks/${taskId}/state`, { state: 'ready_for_development' }).expect(409);
      await api('leaderA').post(criteriaUrl(taskId), { description: 'Critério mínimo' }).expect(201);
      await api('leaderA').post(`/api/tasks/${taskId}/state`, { state: 'ready_for_development' }).expect(200);
    });

    it('CA06.3, CA06.4, RN13 — com um critério por cumprir não fica «Terminada»; com todos cumpridos pela API, fica', async () => {
      const taskId = await newTask({ state: 'in_testing', assigneeId: users.memberA.id });
      const first = await api('leaderA').post(criteriaUrl(taskId), { description: 'Primeiro' }).expect(201);
      const second = await api('leaderA').post(criteriaUrl(taskId), { description: 'Segundo' }).expect(201);
      await api('memberA').patch(`${criteriaUrl(taskId)}/${first.body.id}`, { isMet: true }).expect(200);
      const refused = await api('memberA').post(`/api/tasks/${taskId}/state`, { state: 'done' }).expect(409);
      expect(refused.body.detail).toContain('critérios');
      const task = await api('memberA').get(`/api/tasks/${taskId}`).expect(200);
      expect(task.body.acceptanceCriteria.filter((c: { isMet: boolean }) => !c.isMet).map((c: { id: string }) => c.id)).toEqual([second.body.id]);
      await api('memberA').patch(`${criteriaUrl(taskId)}/${second.body.id}`, { isMet: true }).expect(200);
      const done = await api('memberA').post(`/api/tasks/${taskId}/state`, { state: 'done' }).expect(200);
      expect(done.body.state).toBe('done');
    });

    it('RN13 (decisão 4a) — numa tarefa «Terminada» ou «Entregue» não se acrescentam critérios nem se desmarca o cumprimento (409)', async () => {
      for (const state of ['done', 'delivered']) {
        const taskId = await newTask({ state });
        const criterionId = await fx.criterion(taskId, users.leaderA.id, true);
        const added = await api('leaderA').post(criteriaUrl(taskId), { description: 'Tarde demais' }).expect(409);
        expect(added.body.detail).toContain('recue-a de estado');
        await api('admin').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: false }).expect(409);
        await api('leaderA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { description: 'Novo texto', isMet: false }).expect(409);
        expect(await criterionRow(criterionId)).toMatchObject({ description: 'Critério de teste', is_met: true });
        expect(await criterionCount(taskId)).toBe(1);
        expect(await history(criterionId)).toEqual([]);
        // Alterar só o texto (líder, RN24) continua permitido.
        await api('leaderA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { description: 'Texto revisto' }).expect(200);
      }
    });

    it('Validação e 404 — descrição vazia, corpo vazio, campos desconhecidos (400); critério de outra tarefa, id mal formado, tarefa eliminada (404)', async () => {
      const taskId = await newTask();
      const otherTaskId = await newTask();
      const criterionId = await fx.criterion(otherTaskId, users.leaderA.id);
      const blank = await api('leaderA').post(criteriaUrl(taskId), { description: '   ' }).expect(400);
      expect(blank.body.errors[0].field).toBe('description');
      await api('leaderA').post(criteriaUrl(taskId), {}).expect(400);
      await api('leaderA').post(criteriaUrl(taskId), { description: 'Ok', isMet: true }).expect(400);
      const own = await fx.criterion(taskId, users.leaderA.id);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${own}`, {}).expect(400);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${own}`, { isMet: 'sim' }).expect(400);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${own}`, { description: null }).expect(400);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${criterionId}`, { isMet: true }).expect(404);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/nao-e-um-id`, { isMet: true }).expect(404);
      expect(await criterionRow(criterionId)).toMatchObject({ is_met: false });

      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [taskId]);
      await api('leaderA').post(criteriaUrl(taskId), { description: 'Eliminada' }).expect(404);
      await api('leaderA').patch(`${criteriaUrl(taskId)}/${own}`, { isMet: true }).expect(404);
    });
  });
});
