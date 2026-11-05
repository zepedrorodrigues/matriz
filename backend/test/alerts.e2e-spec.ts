import request from 'supertest';
import { SprintJobService } from '../src/modules/planning/sprint-job.service';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I11, passo 2 — Alertas: US07 CA07.5, CA07.7, CA07.8; US08 CA08.2; US05 CA05.8; RN09, RN18, RN19, RN30;
 * DT07; SEC07. Decisões do humano (F21): o alerta de prazo é um por tarefa, destinatário e prazo (um novo
 * prazo volta a alertar); a sobrecarga alerta só na passagem a sobrecarregado e volta a alertar depois de
 * deixar de estar.
 */
describe('I11 — alertas', () => {
  let t: TestApp;
  let fx: Fixtures;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let teamA: string, projectId: string, epicId: string;

  const as = (who: string) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object = {}) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      put: (url: string, body: object) => auth(request(t.server).put(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };
  const task = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) => fx.task({ epicId, teamId: teamA, createdBy: ids.leaderA, ...opts });
  type AlertBody = { id: string; type: string; readAt: string | null; task: { id: string } | null; team: { id: string } | null; member: { id: string; name: string } | null; sprintId: string | null; dueDate: string | null };
  const alerts = async (who: string): Promise<AlertBody[]> => (await as(who).get('/api/alerts?pageSize=100').expect(200)).body.items;
  const of = async (who: string, type: string, match: (a: AlertBody) => boolean = () => true) => (await alerts(who)).filter((a) => a.type === type && match(a));
  const forTask = (taskId: string) => (a: AlertBody) => a.task?.id === taskId;
  const forSprint = (sprintId: string, member?: string) => (a: AlertBody) => a.sprintId === sprintId && (member === undefined || a.member?.id === member);

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    for (const [k, opts] of Object.entries({ admin: { isAdmin: true }, manager: {}, leaderA: {}, leaderA2: {}, memberA: {}, memberA2: {}, outsider: {} })) {
      const u = await fx.user(k, opts);
      ids[k] = u.id;
      tokens[k] = await t.token({ email: u.email });
    }
    teamA = await fx.team('Alfa', [
      { userId: ids.leaderA, role: 'leader' },
      { userId: ids.leaderA2, role: 'leader' },
      { userId: ids.memberA, role: 'member' },
      { userId: ids.memberA2, role: 'member' },
    ]);
    await fx.team('Fora', [{ userId: ids.outsider, role: 'leader' }]);
    projectId = await fx.project('Projeto', { managers: [ids.manager], teams: [teamA] });
    epicId = await fx.epic(await fx.objective(projectId));
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA07.5, RN30, DT07 — ao bloquear, os líderes da equipa recebem um alerta (na mesma transação); o membro e quem é de fora não', async () => {
    const id = await task({ assigneeId: ids.memberA, state: 'in_development' });
    await as('memberA').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'À espera do fornecedor' }).expect(200);
    for (const leader of ['leaderA', 'leaderA2']) {
      const [a] = await of(leader, 'task_blocked', forTask(id));
      expect(a).toMatchObject({ readAt: null, task: { id, isBlocked: true, blockReason: 'À espera do fornecedor' }, team: null });
    }
    expect(await of('memberA', 'task_blocked', forTask(id))).toEqual([]);
    expect(await of('outsider', 'task_blocked', forTask(id))).toEqual([]);
    // Mudar só o motivo não volta a alertar; desbloquear e bloquear de novo alerta.
    await as('memberA').patch(`/api/tasks/${id}`, { blockReason: 'Outro motivo' }).expect(200);
    expect(await of('leaderA', 'task_blocked', forTask(id))).toHaveLength(1);
    await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: false }).expect(200);
    await as('leaderA').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'De novo' }).expect(200);
    expect(await of('leaderA', 'task_blocked', forTask(id))).toHaveLength(2);
  });

  it('CA07.8, RN18, RN30 — ao reabrir uma tarefa entregue, o responsável e os líderes recebem um alerta (sem duplicar quem é as duas coisas)', async () => {
    const id = await task({ assigneeId: ids.memberA, state: 'delivered' });
    await as('manager').post(`/api/tasks/${id}/state`, { state: 'in_development' }).expect(200);
    for (const who of ['memberA', 'leaderA', 'leaderA2']) expect(await of(who, 'task_reopened', forTask(id))).toHaveLength(1);
    expect(await of('memberA2', 'task_reopened', forTask(id))).toEqual([]);
    expect(await of('manager', 'task_reopened', forTask(id))).toEqual([]);
    const own = await task({ assigneeId: ids.leaderA, state: 'delivered' });
    await as('leaderA').post(`/api/tasks/${own}/state`, { state: 'in_development' }).expect(200);
    expect(await of('leaderA', 'task_reopened', forTask(own))).toHaveLength(1);
    // Uma mudança de estado que não é reabertura não alerta.
    const plain = await task({ assigneeId: ids.memberA, state: 'in_planning' });
    await as('leaderA').post(`/api/tasks/${plain}/state`, { state: 'in_technical_analysis' }).expect(200);
    expect(await of('memberA', 'task_reopened', forTask(plain))).toEqual([]);
  });

  it('CA08.2, RN09 — a tarefa criada por um membro alerta os líderes da equipa; criada por um líder ou pelo gestor, não', async () => {
    const byMember = await as('memberA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do membro' }).expect(201);
    for (const leader of ['leaderA', 'leaderA2']) expect(await of(leader, 'member_task_created', forTask(byMember.body.id))).toHaveLength(1);
    expect(await of('memberA', 'member_task_created', forTask(byMember.body.id))).toEqual([]);
    const byLeader = await as('leaderA').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do líder' }).expect(201);
    const byManager = await as('manager').post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Do gestor' }).expect(201);
    for (const created of [byLeader, byManager]) expect(await of('leaderA2', 'member_task_created', forTask(created.body.id))).toEqual([]);
    // Uma subtarefa criada pelo membro também alerta.
    const sub = await as('memberA').post(`/api/projects/${projectId}/tasks`, { parentTaskId: byMember.body.id, teamId: teamA, title: 'Subtarefa' }).expect(201);
    expect(await of('leaderA', 'member_task_created', forTask(sub.body.id))).toHaveLength(1);
  });

  it('CA07.7, RN30, F21 — a tarefa diária alerta o responsável e os líderes quando o prazo passa; não repete; um novo prazo volta a alertar; concluída não alerta', async () => {
    const job = t.app.get(SprintJobService);
    const late = await task({ assigneeId: ids.memberA, title: 'Com prazo' });
    const finished = await task({ assigneeId: ids.memberA, state: 'done' });
    const noOwner = await task({ title: 'Sem responsável' });
    await t.db.query(`UPDATE work.task SET due_date = '2031-05-10' WHERE id = ANY($1)`, [[late, finished, noOwner]]);
    // No próprio dia do prazo ainda não está ultrapassado.
    await job.runOnce('2031-05-10');
    expect(await of('memberA', 'deadline_passed', forTask(late))).toEqual([]);
    await job.runOnce('2031-05-11');
    for (const who of ['memberA', 'leaderA', 'leaderA2']) {
      expect(await of(who, 'deadline_passed', forTask(late))).toEqual([expect.objectContaining({ dueDate: '2031-05-10' })]);
    }
    expect(await of('memberA2', 'deadline_passed', forTask(late))).toEqual([]);
    expect(await of('leaderA', 'deadline_passed', forTask(finished))).toEqual([]);
    expect(await of('leaderA', 'deadline_passed', forTask(noOwner))).toHaveLength(1);
    // Não repete enquanto o prazo for o mesmo.
    await job.runOnce('2031-05-12');
    expect(await of('memberA', 'deadline_passed', forTask(late))).toHaveLength(1);
    // Novo prazo, também ultrapassado → novo alerta.
    await as('leaderA').patch(`/api/tasks/${late}`, { dueDate: '2031-05-11' }).expect(200);
    await job.runOnce('2031-05-12');
    expect((await of('memberA', 'deadline_passed', forTask(late))).map((a) => a.dueDate).sort()).toEqual(['2031-05-10', '2031-05-11']);
    // Tarefa eliminada ou de um projeto eliminado: não alerta.
    const gone = await task({ assigneeId: ids.memberA2 });
    await t.db.query(`UPDATE work.task SET due_date = '2031-05-10', deleted_at = now() WHERE id = $1`, [gone]);
    const deletedProject = await fx.project('Eliminado', { teams: [teamA], deleted: true });
    const lost = await fx.task({ epicId: await fx.epic(await fx.objective(deletedProject)), teamId: teamA, createdBy: ids.leaderA, assigneeId: ids.memberA2 });
    await t.db.query(`UPDATE work.task SET due_date = '2031-05-10' WHERE id = $1`, [lost]);
    await job.runOnce('2031-05-13');
    expect(await of('memberA2', 'deadline_passed')).toEqual([]);
  });

  describe('Sobrecarga (CA05.8, RN19, F21)', () => {
    // Equipa própria: líder e membro a 100 %, 10 dias úteis → 80 h cada, 160 h a equipa.
    let team: string, leader: string, member: string;
    const sprintOf = async (startDate: string, endDate: string) =>
      (await as('leaderS').post(`/api/teams/${team}/sprints`, { startDate, endDate }).expect(201)).body.id as string;
    const work = (assigneeId: string, estimateHours: number) =>
      fx.task({ epicId, teamId: team, createdBy: leader, assigneeId, estimateHours });

    beforeAll(async () => {
      for (const k of ['leaderS', 'memberS']) {
        const u = await fx.user(k);
        ids[k] = u.id;
        tokens[k] = await t.token({ email: u.email });
      }
      leader = ids.leaderS;
      member = ids.memberS;
      team = await fx.team('Sobrecarga', [
        { userId: leader, role: 'leader' },
        { userId: member, role: 'member' },
      ]);
      await t.db.query(`INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)`, [projectId, team]);
    });

    it('CA05.8, RN19 — individual: a pessoa e os líderes; da equipa: líderes e membros; só na passagem; volta a alertar depois de deixar de estar', async () => {
      const sprintId = await sprintOf('2031-06-02', '2031-06-13');
      const big = await work(member, 90);
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: big }).expect(201);
      for (const who of ['memberS', 'leaderS']) {
        expect(await of(who, 'individual_overload', forSprint(sprintId))).toEqual([expect.objectContaining({ team: expect.objectContaining({ id: team }), member: expect.objectContaining({ id: member }), task: null })]);
      }
      expect(await of('leaderS', 'team_overload', forSprint(sprintId))).toEqual([]);
      // Equipa acima de 160 h; o líder fica nas 80 h (não está acima): só o alerta da equipa, para os dois.
      const more = await work(leader, 80);
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: more }).expect(201);
      for (const who of ['memberS', 'leaderS']) expect(await of(who, 'team_overload', forSprint(sprintId))).toHaveLength(1);
      expect(await of('leaderS', 'individual_overload', forSprint(sprintId, member))).toHaveLength(1);
      expect(await of('leaderS', 'individual_overload', forSprint(sprintId, leader))).toEqual([]);
      // Enquanto dura, não repete.
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: await work(member, 2) }).expect(201);
      expect(await of('memberS', 'individual_overload', forSprint(sprintId))).toHaveLength(1);
      expect(await of('memberS', 'team_overload', forSprint(sprintId))).toHaveLength(1);
      // Deixa de estar (retira a tarefa grande: membro e equipa) e volta a estar (estimativa do líder; tarefa de volta) → novos alertas.
      await as('leaderS').delete(`/api/sprints/${sprintId}/tasks/${big}`).expect(200);
      await as('leaderS').patch(`/api/tasks/${more}`, { estimateHours: 81 }).expect(200);
      expect(await of('leaderS', 'individual_overload', forSprint(sprintId, leader))).toHaveLength(1);
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: big }).expect(201);
      expect(await of('memberS', 'individual_overload', forSprint(sprintId, member))).toHaveLength(2);
      expect(await of('memberS', 'team_overload', forSprint(sprintId))).toHaveLength(2);
    });

    it('CA05.5, CA05.8 — reduzir a disponibilidade de um membro que passa a ficar sobrecarregado alerta; mudar o responsável também', async () => {
      const sprintId = await sprintOf('2031-07-07', '2031-07-18');
      const piece = await work(member, 40);
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: piece }).expect(201);
      expect(await of('memberS', 'individual_overload', forSprint(sprintId))).toEqual([]);
      await as('leaderS').put(`/api/sprints/${sprintId}/availability/${member}`, { availableHours: 30 }).expect(200);
      expect(await of('memberS', 'individual_overload', forSprint(sprintId))).toHaveLength(1);
      await as('leaderS').delete(`/api/sprints/${sprintId}/availability/${member}`).expect(200);
      const other = await work(leader, 70);
      await as('leaderS').post(`/api/sprints/${sprintId}/tasks`, { taskId: other }).expect(201);
      expect(await of('leaderS', 'individual_overload', forSprint(sprintId, leader))).toEqual([]);
      await as('leaderS').patch(`/api/tasks/${piece}`, { assigneeId: leader }).expect(200);
      // O líder passa a 110 h: alerta para ele (pessoa e líder ao mesmo tempo, um só alerta).
      expect(await of('leaderS', 'individual_overload', forSprint(sprintId, leader))).toHaveLength(1);
    });
  });

  describe('Consulta e leitura (SEC07)', () => {
    it('SEC07 — cada pessoa vê só os seus alertas, mais recentes primeiro, com os não lidos; marcar como lido só o destinatário (404 para os outros)', async () => {
      const id = await task({ assigneeId: ids.memberA2, state: 'in_development' });
      await as('memberA2').patch(`/api/tasks/${id}`, { isBlocked: true, blockReason: 'Leitura' }).expect(200);
      const before = (await as('leaderA2').get('/api/alerts').expect(200)).body;
      expect(before).toMatchObject({ page: 1, pageSize: 20, total: expect.any(Number), unreadCount: before.total });
      const [latest] = before.items;
      expect(latest).toMatchObject({ type: 'task_blocked', task: { id } });
      const times = before.items.map((a: { createdAt: string }) => a.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
      await as('leaderA').post(`/api/alerts/${latest.id}/read`).expect(404);
      await as('outsider').post(`/api/alerts/${latest.id}/read`).expect(404);
      await as('leaderA2').post('/api/alerts/nao-e-um-uuid/read').expect(404);
      const read = await as('leaderA2').post(`/api/alerts/${latest.id}/read`).expect(200);
      expect(read.body).toMatchObject({ id: latest.id, readAt: expect.any(String) });
      // Idempotente: a data de leitura não muda.
      expect((await as('leaderA2').post(`/api/alerts/${latest.id}/read`).expect(200)).body.readAt).toBe(read.body.readAt);
      expect((await as('leaderA2').get('/api/alerts').expect(200)).body.unreadCount).toBe(before.unreadCount - 1);
      expect((await as('outsider').get('/api/alerts').expect(200)).body.items.every((a: AlertBody) => a.id !== latest.id)).toBe(true);
      await as('leaderA2').get('/api/alerts?pageSize=101').expect(400);
      await as('leaderA2').get('/api/alerts?page=0').expect(400);
      await request(t.server).get('/api/alerts').expect(401);
    });
  });
});
