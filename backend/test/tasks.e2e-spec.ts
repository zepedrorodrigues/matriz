import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I4 — Hierarquia e tarefas (Ficha PL 03, Ex. 5): US02 CA02.1–CA02.4, CA02.8, CA02.9; US03 CA03.1,
 * CA03.7, CA03.11, CA03.12, CA03.17–CA03.19; RN26/RN27/RN13 (estado), RN21, RN38, RN39, D49 (edição),
 * RN32 (histórico), §3.1 e Ex. 8 (casos 03, 04, 05, 08, 09).
 */
describe('I4 — hierarquia e tarefas', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  type Role = 'admin' | 'manager' | 'leaderA' | 'memberA' | 'memberA2' | 'leaderB' | 'outsider';
  const users = {} as Record<Role, U>;
  const tokens = {} as Record<Role, string>;
  let teamA: string, teamB: string, teamC: string;
  let projectId: string, otherProjectId: string;
  let objectiveId: string, epicId: string, otherEpicId: string;

  const api = (role: Role | null) => {
    const auth = (r: request.Test) => (role ? r.set('Authorization', `Bearer ${tokens[role]}`) : r);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };

  const taskRow = async (id: string) => {
    const [r] = await t.db.query(`SELECT title, description, state, priority, team_id, deleted_at FROM work.task WHERE id = $1`, [id]);
    return r as { title: string; description: string | null; state: string; priority: string; team_id: string; deleted_at: Date | null };
  };
  const taskCount = async () => (await t.db.query(`SELECT count(*)::int AS n FROM work.task`))[0].n as number;
  const history = (id: string) =>
    t.db.query(
      `SELECT event_type, old_value, new_value, author_id FROM history.history_event
       WHERE entity_id = $1 ORDER BY id`,
      [id],
    );
  const newTask = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) =>
    fx.task({ epicId, teamId: teamA, createdBy: users.leaderA.id, ...opts });

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
    teamC = await fx.team('Equipa C', [{ userId: users.outsider.id, role: 'leader' }]);
    projectId = await fx.project('Projeto das tarefas', { managers: [users.manager.id], teams: [teamA, teamB] });
    otherProjectId = await fx.project('Outro projeto', { teams: [teamC] });
    objectiveId = await fx.objective(projectId);
    epicId = await fx.epic(objectiveId);
    otherEpicId = await fx.epic(await fx.objective(otherProjectId));
    for (const role of Object.keys(users) as Role[]) tokens[role] = await t.token({ email: users[role].email });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('US02 — objetivos e épicos', () => {
    it('CA02.1 — o líder de uma equipa do projeto cria um objetivo, que fica no topo da hierarquia; o histórico regista', async () => {
      const res = await api('leaderA').post(`/api/projects/${projectId}/objectives`, { title: '  Reduzir prazos  ', description: 'Meta' }).expect(201);
      expect(res.body).toMatchObject({ projectId, title: 'Reduzir prazos', description: 'Meta', epics: [] });
      const list = await api('memberA').get(`/api/projects/${projectId}/objectives`).expect(200);
      expect(list.body.map((o: { id: string }) => o.id)).toContain(res.body.id);
      expect(await history(res.body.id)).toEqual([expect.objectContaining({ event_type: 'created', author_id: users.leaderA.id })]);
    });

    it('CA02.2 — o gestor cria um épico num objetivo; pertence ao projeto do objetivo', async () => {
      const res = await api('manager').post(`/api/objectives/${objectiveId}/epics`, { title: 'Épico novo' }).expect(201);
      expect(res.body).toMatchObject({ objectiveId, title: 'Épico novo', description: null });
      const list = await api('admin').get(`/api/projects/${projectId}/objectives`).expect(200);
      const objective = list.body.find((o: { id: string }) => o.id === objectiveId);
      expect(objective.epics.map((e: { id: string }) => e.id)).toContain(res.body.id);
    });

    it('§3.1 — o membro e quem não vê o projeto não criam objetivos nem épicos (403); título só com espaços → 400; objetivo inexistente → 404', async () => {
      await api('memberA').post(`/api/projects/${projectId}/objectives`, { title: 'X' }).expect(403);
      await api('outsider').post(`/api/projects/${projectId}/objectives`, { title: 'X' }).expect(403);
      await api('memberA').post(`/api/objectives/${objectiveId}/epics`, { title: 'X' }).expect(403);
      const blank = await api('leaderA').post(`/api/projects/${projectId}/objectives`, { title: '   ' }).expect(400);
      expect(blank.body.errors[0].field).toBe('title');
      await api('admin').post('/api/objectives/00000000-0000-4000-8000-000000000000/epics', { title: 'X' }).expect(404);
      await api('outsider').get(`/api/projects/${projectId}/objectives`).expect(403);
    });
  });

  describe('Criar tarefas', () => {
    it('CA03.1, CA02.3, CA03.11 — o líder cria uma tarefa: «Em planeamento», prioridade «Média», criador do token; persiste e consta da listagem', async () => {
      const res = await api('leaderA')
        .post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: '  Exportar relatório  ', description: 'Em PDF' })
        .expect(201);
      expect(res.body).toMatchObject({
        projectId,
        epicId,
        parentTaskId: null,
        title: 'Exportar relatório',
        description: 'Em PDF',
        teamId: teamA,
        originalTeamId: teamA,
        state: 'in_planning',
        priority: 'medium',
        assignee: null,
        subtasks: [],
        createdBy: { id: users.leaderA.id, name: 'Lider A' },
      });
      expect(await taskRow(res.body.id)).toMatchObject({ title: 'Exportar relatório', state: 'in_planning', priority: 'medium', deleted_at: null });
      const list = await api('memberA').get(`/api/projects/${projectId}/tasks`).expect(200);
      expect(list.body.items[0]).toMatchObject({ id: res.body.id, title: 'Exportar relatório', subtaskCount: 0 });
      expect(await history(res.body.id)).toEqual([
        expect.objectContaining({ event_type: 'created', old_value: null, author_id: users.leaderA.id }),
      ]);
    });

    it('RN39, RN21 — o membro cria no backlog da sua equipa e pode definir a prioridade ao criar', async () => {
      const res = await api('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Tarefa do membro', priority: 'high' }).expect(201);
      expect(res.body).toMatchObject({ priority: 'high', createdBy: { id: users.memberA.id } });
    });

    it('RN21, §3.1 — membro e líder não criam tarefas para outra equipa; quem não vê o projeto também não (403, nada criado)', async () => {
      const before = await taskCount();
      await api('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamB, title: 'Outra equipa' }).expect(403);
      await api('leaderB').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Outra equipa' }).expect(403);
      await api('outsider').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamC, title: 'Sem acesso' }).expect(403);
      expect(await taskCount()).toBe(before);
    });

    it('CA03.7 — equipa não associada ao projeto → 422 e nada é criado', async () => {
      const before = await taskCount();
      const res = await api('manager').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamC, title: 'Equipa errada' }).expect(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(await taskCount()).toBe(before);
    });

    it('CA02.9 — tarefa sem épico → 400; épico de outro projeto → 422', async () => {
      const before = await taskCount();
      const noEpic = await api('admin').post(`/api/projects/${projectId}/tasks`, { teamId: teamA, title: 'Sem épico' }).expect(400);
      expect(noEpic.body.errors[0].field).toBe('epicId');
      await api('admin').post(`/api/projects/${projectId}/tasks`, { epicId, title: 'Sem equipa' }).expect(400);
      await api('admin').post(`/api/projects/${projectId}/tasks`, { epicId: otherEpicId, teamId: teamA, title: 'Épico alheio' }).expect(422);
      expect(await taskCount()).toBe(before);
    });

    it('CA02.4 — a subtarefa herda a equipa da tarefa principal, não aparece na listagem do projeto e conta nas subtarefas', async () => {
      const parentId = await newTask({ title: 'Principal', estimateHours: 99 });
      const res = await api('memberA').post(`/api/projects/${projectId}/tasks`, { parentTaskId: parentId, title: 'Subtarefa' }).expect(201);
      expect(res.body).toMatchObject({ parentTaskId: parentId, epicId: null, teamId: teamA, projectId, state: 'in_planning' });

      const parent = await api('memberA').get(`/api/tasks/${parentId}`).expect(200);
      expect(parent.body.subtasks).toEqual([expect.objectContaining({ id: res.body.id, title: 'Subtarefa' })]);
      // RN22: com subtarefas, a estimativa da tarefa é a soma das subtarefas (aqui, sem estimativas).
      expect(parent.body.estimateHours).toBeNull();
      const list = await api('memberA').get(`/api/projects/${projectId}/tasks?pageSize=100`).expect(200);
      const ids = list.body.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(parentId);
      expect(ids).not.toContain(res.body.id);
      expect(list.body.items.find((i: { id: string }) => i.id === parentId).subtaskCount).toBe(1);
    });

    it('CA02.8, RN12 — subtarefa com outra equipa → 422; subtarefa de uma subtarefa → 422; tarefa principal de outro projeto → 422', async () => {
      const parentId = await newTask();
      const subId = await fx.task({ parentTaskId: parentId, teamId: teamA, createdBy: users.leaderA.id });
      const foreign = await fx.task({ epicId: otherEpicId, teamId: teamC, createdBy: users.outsider.id });
      const before = await taskCount();
      await api('manager').post(`/api/projects/${projectId}/tasks`, { parentTaskId: parentId, teamId: teamB, title: 'Outra equipa' }).expect(422);
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { parentTaskId: subId, title: 'Neta' }).expect(422);
      await api('admin').post(`/api/projects/${projectId}/tasks`, { parentTaskId: foreign, title: 'Alheia' }).expect(422);
      await api('admin').post(`/api/projects/${projectId}/tasks`, { parentTaskId: parentId, epicId, title: 'Os dois' }).expect(400);
      expect(await taskCount()).toBe(before);
    });

    it('CA03.18, Ex. 8 (caso 04) — título vazio, só com espaços, curto ou longo e descrição longa → 400 e nada é criado', async () => {
      const before = await taskCount();
      const base = { epicId, teamId: teamA };
      for (const title of ['', '     ', '  ab  ', 'x'.repeat(151)]) {
        const res = await api('leaderA').post(`/api/projects/${projectId}/tasks`, { ...base, title }).expect(400);
        expect(res.body.errors).toEqual([expect.objectContaining({ field: 'title' })]);
      }
      const longDescription = await api('leaderA')
        .post(`/api/projects/${projectId}/tasks`, { ...base, title: 'Válida', description: 'd'.repeat(2001) })
        .expect(400);
      expect(longDescription.body.errors).toEqual([expect.objectContaining({ field: 'description' })]);
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { ...base, title: 'Válida', priority: 'urgent' }).expect(400);
      expect(await taskCount()).toBe(before);
      // Limites aceites, contados depois de retirar os espaços (RN42).
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { ...base, title: '  abc  ' }).expect(201);
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { ...base, title: 'y'.repeat(150), description: 'd'.repeat(2000) }).expect(201);
    });

    it('Ex. 3.3 — o criador não pode ser indicado no pedido; campos fora do contrato não são aceites (400)', async () => {
      const before = await taskCount();
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Com autor', createdBy: users.admin.id }).expect(400);
      await api('leaderA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Com sprint', sprintId: teamA }).expect(400);
      expect(await taskCount()).toBe(before);
    });
  });

  describe('Listar e consultar', () => {
    it('CA03.19, D46 — filtros por estado, por prioridade e por ambos; o total é o do conjunto filtrado, não da página', async () => {
      const projectF = await fx.project('Filtros', { teams: [teamA] });
      const epicF = await fx.epic(await fx.objective(projectF));
      const make = (state: string, priority: string) => fx.task({ epicId: epicF, teamId: teamA, createdBy: users.leaderA.id, state, priority });
      await make('in_planning', 'high');
      await make('in_planning', 'high');
      await make('in_planning', 'low');
      await make('in_testing', 'high');
      await make('done', 'medium');
      const url = `/api/projects/${projectF}/tasks`;

      const byState = await api('memberA').get(`${url}?state=in_planning&pageSize=1`).expect(200);
      expect(byState.body).toMatchObject({ page: 1, pageSize: 1, total: 3 });
      expect(byState.body.items).toHaveLength(1);
      expect((await api('memberA').get(`${url}?priority=high`).expect(200)).body.total).toBe(3);
      const both = await api('memberA').get(`${url}?state=in_planning&priority=high`).expect(200);
      expect(both.body.total).toBe(2);
      expect(both.body.items.every((i: { state: string; priority: string }) => i.state === 'in_planning' && i.priority === 'high')).toBe(true);
      const page2 = await api('memberA').get(`${url}?pageSize=2&page=3`).expect(200);
      expect(page2.body).toMatchObject({ total: 5, items: [expect.any(Object)] });

      await api('memberA').get(`${url}?state=todo`).expect(400);
      await api('memberA').get(`${url}?priority=urgent`).expect(400);
      await api('memberA').get(`${url}?pageSize=101`).expect(400);
    });

    it('§3.1 — consultar a tarefa: critérios, participantes e subtarefas; sem acesso → 403; inexistente ou id mal formado → 404', async () => {
      const id = await newTask({ title: 'Para consultar' });
      await fx.criterion(id, users.leaderA.id, true);
      await t.db.query(`INSERT INTO work.task_participant (task_id, user_id, added_by) VALUES ($1, $2, $3)`, [
        id,
        users.memberA2.id,
        users.leaderA.id,
      ]);
      const res = await api('leaderB').get(`/api/tasks/${id}`).expect(200);
      expect(res.body).toMatchObject({
        title: 'Para consultar',
        acceptanceCriteria: [expect.objectContaining({ isMet: true, metBy: { id: users.leaderA.id, name: 'Lider A' } })],
        participants: [expect.objectContaining({ user: { id: users.memberA2.id, name: 'Membro A2' }, addedBy: { id: users.leaderA.id, name: 'Lider A' } })],
        isOverdue: false,
      });
      await api('outsider').get(`/api/tasks/${id}`).expect(403);
      await api('admin').get('/api/tasks/00000000-0000-4000-8000-000000000000').expect(404);
      await api('admin').get('/api/tasks/nao-e-um-uuid').expect(404);
      await api('outsider').get(`/api/projects/${projectId}/tasks`).expect(403);
    });
  });

  describe('Editar e prioridade', () => {
    it('CA03.12, Ex. 8 (caso 05) — o líder altera a prioridade; a listagem filtrada reflete-a; o histórico guarda os valores', async () => {
      const id = await newTask({ title: 'Prioridade', priority: 'low' });
      const res = await api('leaderA').patch(`/api/tasks/${id}`, { priority: 'high' }).expect(200);
      expect(res.body.priority).toBe('high');
      expect((await taskRow(id)).priority).toBe('high');
      const high = await api('leaderA').get(`/api/projects/${projectId}/tasks?priority=high&pageSize=100`).expect(200);
      expect(high.body.items.map((i: { id: string }) => i.id)).toContain(id);
      expect((await history(id)).at(-1)).toMatchObject({
        event_type: 'updated',
        old_value: { priority: 'low' },
        new_value: { priority: 'high' },
        author_id: users.leaderA.id,
      });
    });

    it('D49 — um membro da equipa responsável edita o título e a descrição; descrição a null fica sem valor', async () => {
      const id = await newTask({ title: 'Título antigo' });
      await api('memberA2').patch(`/api/tasks/${id}`, { title: '  Título novo  ', description: 'Texto' }).expect(200);
      expect(await taskRow(id)).toMatchObject({ title: 'Título novo', description: 'Texto' });
      await api('memberA2').patch(`/api/tasks/${id}`, { description: null }).expect(200);
      expect((await taskRow(id)).description).toBeNull();
    });

    it('RN39, D49 — o membro não altera a prioridade; quem só vê o projeto não edita; sem acesso → 403; nada muda', async () => {
      const id = await newTask({ title: 'Inalterada', priority: 'low' });
      await api('memberA').patch(`/api/tasks/${id}`, { priority: 'high' }).expect(403);
      await api('memberA').patch(`/api/tasks/${id}`, { title: 'Outro', priority: 'high' }).expect(403);
      await api('leaderB').patch(`/api/tasks/${id}`, { title: 'Outro' }).expect(403);
      await api('outsider').patch(`/api/tasks/${id}`, { title: 'Outro' }).expect(403);
      expect(await taskRow(id)).toMatchObject({ title: 'Inalterada', priority: 'low' });
      expect(await history(id)).toEqual([]);
    });

    it('CA03.18 — edição inválida ou vazia → 400 e a tarefa não muda', async () => {
      const id = await newTask({ title: 'Mantém-se' });
      await api('leaderA').patch(`/api/tasks/${id}`, {}).expect(400);
      await api('leaderA').patch(`/api/tasks/${id}`, { title: '   ' }).expect(400);
      await api('leaderA').patch(`/api/tasks/${id}`, { title: null }).expect(400);
      await api('leaderA').patch(`/api/tasks/${id}`, { description: 'd'.repeat(2001) }).expect(400);
      await api('leaderA').patch(`/api/tasks/${id}`, { priority: null }).expect(400);
      await api('leaderA').patch(`/api/tasks/${id}`, { state: 'done' }).expect(400);
      expect(await taskRow(id)).toMatchObject({ title: 'Mantém-se', state: 'in_planning' });
    });
  });

  describe('Estado (RN26)', () => {
    const changeState = (role: Role, id: string, state: string) => api(role).post(`/api/tasks/${id}/state`, { state });

    it('RN26 — avança um estado de cada vez e recua para qualquer anterior; saltar estados → 409 sem alterar', async () => {
      const id = await newTask();
      const res = await changeState('leaderA', id, 'in_technical_analysis').expect(200);
      expect(res.body.state).toBe('in_technical_analysis');
      const skip = await changeState('leaderA', id, 'in_development').expect(409);
      expect(skip.headers['content-type']).toContain('application/problem+json');
      expect((await taskRow(id)).state).toBe('in_technical_analysis');
      await changeState('leaderA', id, 'in_technical_analysis').expect(409);
      await changeState('leaderA', id, 'in_planning').expect(200);
      expect((await history(id)).map((e: { event_type: string; new_value: unknown }) => [e.event_type, e.new_value])).toEqual([
        ['state_changed', { state: 'in_technical_analysis' }],
        ['state_changed', { state: 'in_planning' }],
      ]);
    });

    it('RN27, RN13 — «Pronto a desenvolver» exige um critério; «Terminada» exige todos cumpridos; «Entregue» só a partir de «Terminada»', async () => {
      const id = await newTask({ state: 'in_technical_analysis' });
      await changeState('manager', id, 'ready_for_development').expect(409);
      const criterion = await fx.criterion(id, users.leaderA.id, false);
      await changeState('manager', id, 'ready_for_development').expect(200);
      await changeState('manager', id, 'in_development').expect(200);
      await changeState('manager', id, 'in_testing').expect(200);
      await changeState('manager', id, 'delivered').expect(409);
      await changeState('manager', id, 'done').expect(409);
      await t.db.query(`UPDATE work.acceptance_criterion SET is_met = true WHERE id = $1`, [criterion]);
      await changeState('manager', id, 'done').expect(200);
      await changeState('manager', id, 'delivered').expect(200);
      expect((await taskRow(id)).state).toBe('delivered');
    });

    it('RN26 — de «Entregue» só se sai por reabertura, para «A desenvolver»; fica no histórico como reabertura', async () => {
      const id = await newTask({ state: 'delivered' });
      await changeState('leaderA', id, 'done').expect(409);
      await changeState('leaderA', id, 'in_planning').expect(409);
      await changeState('leaderA', id, 'in_development').expect(200);
      expect((await history(id)).at(-1)).toMatchObject({ event_type: 'reopened', old_value: { state: 'delivered' }, new_value: { state: 'in_development' } });
    });

    it('RN26, §3.1 — o membro move só as tarefas que lhe estão atribuídas, entre «Pronto a desenvolver» e «Terminada»', async () => {
      const mine = await newTask({ state: 'ready_for_development', assigneeId: users.memberA.id });
      await changeState('memberA', mine, 'in_development').expect(200);
      await changeState('memberA', mine, 'ready_for_development').expect(200);
      await changeState('memberA', mine, 'in_technical_analysis').expect(403);
      const notMine = await newTask({ state: 'ready_for_development', assigneeId: users.memberA2.id });
      await changeState('memberA', notMine, 'in_development').expect(403);
      const done = await newTask({ state: 'done', assigneeId: users.memberA.id });
      await changeState('memberA', done, 'delivered').expect(403);
      await changeState('leaderB', notMine, 'in_development').expect(403);
      await changeState('outsider', notMine, 'in_development').expect(403);
      expect((await taskRow(notMine)).state).toBe('ready_for_development');
      expect((await taskRow(done)).state).toBe('done');
    });

    it('RN26 — estado desconhecido → 400', async () => {
      const id = await newTask();
      await changeState('leaderA', id, 'TODO').expect(400);
      await changeState('memberA', id, 'TODO').expect(400);
    });
  });

  describe('Eliminar (RN38)', () => {
    it('CA03.17, Ex. 8 (caso 09) — o líder elimina: a tarefa e as subtarefas saem das listagens e consultas; as linhas mantêm-se; o histórico regista', async () => {
      const id = await newTask({ title: 'A eliminar' });
      const subId = await fx.task({ parentTaskId: id, teamId: teamA, createdBy: users.leaderA.id, title: 'Sub a eliminar' });
      const before = (await api('leaderA').get(`/api/projects/${projectId}/tasks`).expect(200)).body.total;

      await api('leaderA').delete(`/api/tasks/${id}`).expect(204);
      const after = await api('leaderA').get(`/api/projects/${projectId}/tasks?pageSize=100`).expect(200);
      expect(after.body.total).toBe(before - 1);
      expect(after.body.items.map((i: { id: string }) => i.id)).not.toContain(id);
      await api('leaderA').get(`/api/tasks/${id}`).expect(404);
      await api('leaderA').get(`/api/tasks/${subId}`).expect(404);
      await api('leaderA').patch(`/api/tasks/${id}`, { title: 'Depois' }).expect(404);
      await api('leaderA').delete(`/api/tasks/${id}`).expect(404);
      expect((await taskRow(id)).deleted_at).not.toBeNull();
      expect((await taskRow(subId)).deleted_at).not.toBeNull();
      expect((await history(id)).at(-1)).toMatchObject({ event_type: 'deleted', author_id: users.leaderA.id });
      expect((await history(subId)).at(-1)).toMatchObject({ event_type: 'deleted', author_id: users.leaderA.id });
    });

    it('RN38 — eliminar uma subtarefa retira-a das subtarefas e da contagem da tarefa principal', async () => {
      const id = await newTask();
      const subId = await fx.task({ parentTaskId: id, teamId: teamA, createdBy: users.leaderA.id });
      await api('manager').delete(`/api/tasks/${subId}`).expect(204);
      const parent = await api('manager').get(`/api/tasks/${id}`).expect(200);
      expect(parent.body.subtasks).toEqual([]);
    });

    it('RN38, §3.1 — o membro e quem só vê o projeto não eliminam (403) e a tarefa mantém-se', async () => {
      const id = await newTask();
      await api('memberA').delete(`/api/tasks/${id}`).expect(403);
      await api('leaderB').delete(`/api/tasks/${id}`).expect(403);
      await api('outsider').delete(`/api/tasks/${id}`).expect(403);
      expect((await taskRow(id)).deleted_at).toBeNull();
    });

    it('RN38 — as tarefas de um projeto eliminado respondem 404', async () => {
      const project = await fx.project('Projeto a eliminar', { teams: [teamA] });
      const id = await fx.task({ epicId: await fx.epic(await fx.objective(project)), teamId: teamA, createdBy: users.leaderA.id });
      await t.db.query(`UPDATE organization.project SET deleted_at = now() WHERE id = $1`, [project]);
      await api('admin').get(`/api/tasks/${id}`).expect(404);
      await api('admin').get(`/api/projects/${project}/tasks`).expect(404);
    });
  });

  it('Ex. 8 (caso 08) — mudar os identificadores no pedido não dá acesso a tarefas de outros projetos', async () => {
    const foreign = await fx.task({ epicId: otherEpicId, teamId: teamC, createdBy: users.outsider.id, title: 'Alheia' });
    await api('leaderA').get(`/api/tasks/${foreign}`).expect(403);
    await api('leaderA').patch(`/api/tasks/${foreign}`, { title: 'Mudada' }).expect(403);
    await api('leaderA').post(`/api/tasks/${foreign}/state`, { state: 'in_technical_analysis' }).expect(403);
    await api('leaderA').delete(`/api/tasks/${foreign}`).expect(403);
    await api('leaderA').get(`/api/projects/${otherProjectId}/tasks`).expect(403);
    await api('leaderA').post(`/api/projects/${otherProjectId}/tasks`, { epicId: otherEpicId, teamId: teamA, title: 'Intrusa' }).expect(403);
    expect(await taskRow(foreign)).toMatchObject({ title: 'Alheia', state: 'in_planning', deleted_at: null });
  });

  it('CAT01 — sem token, as operações de tarefas respondem 401', async () => {
    const id = await newTask();
    await api(null).get(`/api/projects/${projectId}/tasks`).expect(401);
    await api(null).post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Sem token' }).expect(401);
    await api(null).get(`/api/tasks/${id}`).expect(401);
    await api(null).patch(`/api/tasks/${id}`, { title: 'Sem token' }).expect(401);
    await api(null).post(`/api/tasks/${id}/state`, { state: 'in_technical_analysis' }).expect(401);
    await api(null).delete(`/api/tasks/${id}`).expect(401);
    await api(null).get(`/api/projects/${projectId}/objectives`).expect(401);
  });
});
