import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I6 — Responsável e participantes (Ficha PL 03, Ex. 6): US03 CA03.3, CA03.6, CA03.13–CA03.16; US09
 * CA09.1, CA09.6; RN03, RN15, RN20, RN40; §3.1. Decisões do humano de 2026-11-05 (F15): 422 para quem
 * não é elegível ou falta a justificação (1a); responsável e participante independentes (2a); o líder
 * remove qualquer participante (3a); na criação, só um responsável da equipa responsável (4a).
 */
describe('I6 — responsável e participantes', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  type Role = 'admin' | 'manager' | 'leaderA' | 'memberA' | 'memberA2' | 'leaderB' | 'memberB' | 'outsider' | 'inactiveA';
  const users = {} as Record<Role, U>;
  const tokens = {} as Partial<Record<Role, string>>;
  let teamA: string, teamB: string;
  let projectId: string, epicId: string;

  const api = (role: Role) => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokens[role]}`);
    return {
      get: (url: string) => auth(request(t.server).get(url)),
      post: (url: string, body: object) => auth(request(t.server).post(url)).send(body),
      patch: (url: string, body: object) => auth(request(t.server).patch(url)).send(body),
      delete: (url: string) => auth(request(t.server).delete(url)),
    };
  };

  const taskRow = async (id: string) => {
    const [r] = await t.db.query(`SELECT assignee_id, team_id FROM work.task WHERE id = $1`, [id]);
    return r as { assignee_id: string | null; team_id: string };
  };
  const participantIds = async (taskId: string) =>
    (await t.db.query(`SELECT user_id FROM work.task_participant WHERE task_id = $1 ORDER BY added_at`, [taskId])).map(
      (r: { user_id: string }) => r.user_id,
    );
  const history = (id: string) =>
    t.db.query(`SELECT event_type, old_value, new_value, author_id FROM history.history_event WHERE entity_id = $1 ORDER BY id`, [id]);
  const newTask = (opts: Partial<Parameters<Fixtures['task']>[0]> = {}) =>
    fx.task({ epicId, teamId: teamA, createdBy: users.leaderA.id, ...opts });
  const participantsUrl = (taskId: string) => `/api/tasks/${taskId}/participants`;

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    users.admin = await fx.user('Admin', { isAdmin: true });
    users.manager = await fx.user('Gestor');
    users.leaderA = await fx.user('Lider A');
    users.memberA = await fx.user('Membro A');
    users.memberA2 = await fx.user('Membro A2');
    users.leaderB = await fx.user('Lider B');
    users.memberB = await fx.user('Membro B');
    users.outsider = await fx.user('Fora');
    users.inactiveA = await fx.user('Inativo A', { active: false });
    teamA = await fx.team('Equipa A', [
      { userId: users.leaderA.id, role: 'leader' },
      { userId: users.memberA.id, role: 'member' },
      { userId: users.memberA2.id, role: 'member' },
      { userId: users.inactiveA.id, role: 'member' },
    ]);
    teamB = await fx.team('Equipa B', [
      { userId: users.leaderB.id, role: 'leader' },
      { userId: users.memberB.id, role: 'member' },
    ]);
    const teamC = await fx.team('Equipa C', [{ userId: users.outsider.id, role: 'leader' }]);
    projectId = await fx.project('Projeto das atribuições', { managers: [users.manager.id], teams: [teamA, teamB] });
    await fx.project('Outro projeto', { teams: [teamC] });
    epicId = await fx.epic(await fx.objective(projectId));
    for (const role of Object.keys(users) as Role[]) {
      if (role !== 'inactiveA') tokens[role] = await t.token({ email: users[role].email });
    }
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Utilizadores elegíveis', () => {
    it('RN40 — scope=team (por omissão): membros ativos da equipa responsável, ordenados pelo nome, para quem vê a tarefa', async () => {
      const taskId = await newTask();
      const res = await api('memberB').get(`/api/tasks/${taskId}/eligible-users`).expect(200);
      expect(res.body).toEqual([
        { id: users.leaderA.id, name: 'Lider A' },
        { id: users.memberA.id, name: 'Membro A' },
        { id: users.memberA2.id, name: 'Membro A2' },
      ]);
      await api('outsider').get(`/api/tasks/${taskId}/eligible-users`).expect(403);
    });

    it('RN03 — scope=all: todos os utilizadores ativos, só para o gestor e o administrador (403 para o líder e o membro)', async () => {
      const taskId = await newTask();
      const res = await api('manager').get(`/api/tasks/${taskId}/eligible-users?scope=all`).expect(200);
      const ids = res.body.map((u: { id: string }) => u.id);
      expect(ids).toEqual(expect.arrayContaining([users.memberB.id, users.outsider.id, users.leaderA.id]));
      expect(ids).not.toContain(users.inactiveA.id);
      await api('admin').get(`/api/tasks/${taskId}/eligible-users?scope=all`).expect(200);
      await api('leaderA').get(`/api/tasks/${taskId}/eligible-users?scope=all`).expect(403);
      await api('memberA').get(`/api/tasks/${taskId}/eligible-users?scope=all`).expect(403);
      await api('manager').get(`/api/tasks/${taskId}/eligible-users?scope=tudo`).expect(400);
    });
  });

  describe('Responsável pela execução', () => {
    it('CA03.3, RN15 — o líder atribui a tarefa a um membro da equipa; a equipa responsável mantém-se; fica no histórico', async () => {
      const taskId = await newTask();
      const res = await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA.id }).expect(200);
      expect(res.body).toMatchObject({ teamId: teamA, assignee: { id: users.memberA.id, name: 'Membro A' } });
      expect(await taskRow(taskId)).toEqual({ assignee_id: users.memberA.id, team_id: teamA });
      await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA2.id }).expect(200);
      await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: null }).expect(200);
      expect(await taskRow(taskId)).toEqual({ assignee_id: null, team_id: teamA });
      expect(await history(taskId)).toEqual([
        expect.objectContaining({ event_type: 'assignee_changed', old_value: { assigneeId: null }, new_value: { assigneeId: users.memberA.id }, author_id: users.leaderA.id }),
        expect.objectContaining({ event_type: 'assignee_changed', old_value: { assigneeId: users.memberA.id }, new_value: { assigneeId: users.memberA2.id } }),
        expect.objectContaining({ event_type: 'assignee_changed', old_value: { assigneeId: users.memberA2.id }, new_value: { assigneeId: null } }),
      ]);
    });

    it('CA03.6, §3.1 — o membro não altera o responsável nem a equipa (403/400) e a tarefa mantém a atribuição', async () => {
      const taskId = await newTask({ assigneeId: users.memberA.id });
      await api('memberA').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA2.id }).expect(403);
      await api('memberA').patch(`/api/tasks/${taskId}`, { assigneeId: null }).expect(403);
      await api('memberA2').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA2.id }).expect(403);
      await api('leaderB').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberB.id }).expect(403);
      // A equipa só muda por transferência (RN20): campo desconhecido.
      await api('memberA').patch(`/api/tasks/${taskId}`, { teamId: teamB }).expect(400);
      await api('leaderA').patch(`/api/tasks/${taskId}`, { teamId: teamB }).expect(400);
      expect(await taskRow(taskId)).toEqual({ assignee_id: users.memberA.id, team_id: teamA });
      expect(await history(taskId)).toEqual([]);
    });

    it('CA03.15, RN03 (decisão 1a) — o líder não atribui a alguém de outra equipa, nem com justificação (422, sem alterações)', async () => {
      const taskId = await newTask();
      const res = await api('leaderA')
        .patch(`/api/tasks/${taskId}`, { assigneeId: users.memberB.id, assignmentJustification: 'Especialista' })
        .expect(422);
      expect(res.body.detail).toContain('não é da equipa responsável');
      expect((await taskRow(taskId)).assignee_id).toBeNull();
      expect(await history(taskId)).toEqual([]);
    });

    it('CA09.1, RN03, RN20 — o gestor atribui a alguém de outra equipa com justificação; a equipa não muda; a justificação fica no histórico', async () => {
      const taskId = await newTask();
      const res = await api('manager')
        .patch(`/api/tasks/${taskId}`, { assigneeId: users.memberB.id, assignmentJustification: '  Conhece a integração  ' })
        .expect(200);
      expect(res.body).toMatchObject({ teamId: teamA, assignee: { id: users.memberB.id } });
      expect(await history(taskId)).toEqual([
        expect.objectContaining({
          event_type: 'assignee_changed',
          new_value: { assigneeId: users.memberB.id, crossTeam: true, justification: 'Conhece a integração' },
          author_id: users.manager.id,
        }),
      ]);
      // O administrador também pode; alguém fora de qualquer equipa do projeto conta como outra equipa.
      await api('admin').patch(`/api/tasks/${taskId}`, { assigneeId: users.outsider.id, assignmentJustification: 'Apoio' }).expect(200);
    });

    it('CA09.6 — sem justificação (ou só com espaços), a atribuição a outra equipa é recusada (422) e nada muda', async () => {
      const taskId = await newTask({ assigneeId: users.memberA.id });
      const res = await api('manager').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberB.id }).expect(422);
      expect(res.body.detail).toContain('justificação');
      await api('admin').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberB.id, assignmentJustification: '   ' }).expect(422);
      expect((await taskRow(taskId)).assignee_id).toBe(users.memberA.id);
      // Justificação sem responsável → 400.
      await api('manager').patch(`/api/tasks/${taskId}`, { title: 'Novo', assignmentJustification: 'x' }).expect(400);
      expect(await history(taskId)).toEqual([]);
    });

    it('Existência — utilizador inexistente ou desativado → 422; id mal formado → 400; nada muda', async () => {
      const taskId = await newTask();
      await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: '00000000-0000-4000-8000-000000000000' }).expect(422);
      const inactive = await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: users.inactiveA.id }).expect(422);
      expect(inactive.body.detail).toContain('desativado');
      await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: 'rui' }).expect(400);
      expect((await taskRow(taskId)).assignee_id).toBeNull();
    });

    it('Decisão 4a — na criação: o líder atribui a um membro da equipa; alguém de outra equipa → 422; o membro não atribui (403)', async () => {
      const ok = await api('leaderA')
        .post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Com responsável', assigneeId: users.memberA.id })
        .expect(201);
      expect(ok.body.assignee).toEqual({ id: users.memberA.id, name: 'Membro A' });
      expect((await history(ok.body.id))[0].new_value).toMatchObject({ assigneeId: users.memberA.id });
      const before = (await t.db.query(`SELECT count(*)::int AS n FROM work.task`))[0].n;
      await api('manager')
        .post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Outra equipa', assigneeId: users.memberB.id })
        .expect(422);
      await api('memberA')
        .post(`/api/projects/${projectId}/tasks`, { epicId, teamId: teamA, title: 'Membro atribui', assigneeId: users.memberA.id })
        .expect(403);
      expect((await t.db.query(`SELECT count(*)::int AS n FROM work.task`))[0].n).toBe(before);
      // Subtarefa: a equipa é a da tarefa principal.
      const sub = await api('leaderA')
        .post(`/api/projects/${projectId}/tasks`, { parentTaskId: ok.body.id, title: 'Subtarefa atribuída', assigneeId: users.memberA2.id })
        .expect(201);
      expect(sub.body.assignee.id).toBe(users.memberA2.id);
    });
  });

  describe('Participantes', () => {
    it('CA03.13, RN40 — o líder associa vários membros da equipa; o responsável pela execução não muda; fica no histórico', async () => {
      const taskId = await newTask({ assigneeId: users.memberA.id });
      const first = await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA2.id }).expect(201);
      expect(first.body).toEqual({
        user: { id: users.memberA2.id, name: 'Membro A2' },
        addedBy: { id: users.leaderA.id, name: 'Lider A' },
        addedAt: expect.any(String),
      });
      // Decisão 2a: o responsável pela execução também pode ser participante.
      await api('manager').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(201);
      await api('admin').post(participantsUrl(taskId), { userId: users.leaderA.id }).expect(201);
      expect(await participantIds(taskId)).toEqual([users.memberA2.id, users.memberA.id, users.leaderA.id]);
      expect((await taskRow(taskId)).assignee_id).toBe(users.memberA.id);
      const list = await api('memberB').get(participantsUrl(taskId)).expect(200);
      expect(list.body.map((p: { user: { id: string } }) => p.user.id)).toEqual([users.memberA2.id, users.memberA.id, users.leaderA.id]);
      const task = await api('memberA').get(`/api/tasks/${taskId}`).expect(200);
      expect(task.body.participants).toHaveLength(3);
      expect((await history(taskId)).map((e: { event_type: string; new_value: unknown }) => [e.event_type, e.new_value])).toEqual([
        ['participant_added', { userId: users.memberA2.id }],
        ['participant_added', { userId: users.memberA.id }],
        ['participant_added', { userId: users.leaderA.id }],
      ]);
    });

    it('CA03.14 — associar de novo o mesmo utilizador é recusado (409) e a associação não fica duplicada', async () => {
      const taskId = await newTask();
      await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(201);
      const res = await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(409);
      expect(res.body.detail).toContain('já é participante');
      await api('manager').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(409);
      expect(await participantIds(taskId)).toEqual([users.memberA.id]);
      expect(await history(taskId)).toHaveLength(1);
    });

    it('CA03.15, RN03 — o líder não associa alguém de outra equipa (422); o gestor associa com justificação, sem ela → 422', async () => {
      const taskId = await newTask();
      await api('leaderA').post(participantsUrl(taskId), { userId: users.memberB.id, justification: 'Apoio' }).expect(422);
      await api('manager').post(participantsUrl(taskId), { userId: users.memberB.id }).expect(422);
      expect(await participantIds(taskId)).toEqual([]);
      await api('manager').post(participantsUrl(taskId), { userId: users.memberB.id, justification: 'Revisão de segurança' }).expect(201);
      expect(await participantIds(taskId)).toEqual([users.memberB.id]);
      expect((await history(taskId))[0].new_value).toEqual({ userId: users.memberB.id, crossTeam: true, justification: 'Revisão de segurança' });
    });

    it('RN40, §3.1 — o membro e o líder de outra equipa não gerem participantes (403); inexistente/desativado → 422', async () => {
      const taskId = await newTask({ assigneeId: users.memberA.id });
      await api('memberA').post(participantsUrl(taskId), { userId: users.memberA2.id }).expect(403);
      await api('leaderB').post(participantsUrl(taskId), { userId: users.memberA2.id }).expect(403);
      await api('leaderA').post(participantsUrl(taskId), { userId: users.inactiveA.id }).expect(422);
      await api('leaderA').post(participantsUrl(taskId), { userId: '00000000-0000-4000-8000-000000000000' }).expect(422);
      await api('leaderA').post(participantsUrl(taskId), { userId: 'x' }).expect(400);
      await api('leaderA').post(participantsUrl(taskId), {}).expect(400);
      expect(await participantIds(taskId)).toEqual([]);
    });

    it('CA03.16 — o líder remove um participante (também de outra equipa, decisão 3a); fica no histórico; o membro não remove', async () => {
      const taskId = await newTask();
      await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(201);
      await api('manager').post(participantsUrl(taskId), { userId: users.memberB.id, justification: 'Apoio' }).expect(201);
      await api('memberA').delete(`${participantsUrl(taskId)}/${users.memberB.id}`).expect(403);
      await api('leaderA').delete(`${participantsUrl(taskId)}/${users.memberB.id}`).expect(204);
      expect(await participantIds(taskId)).toEqual([users.memberA.id]);
      await api('leaderA').delete(`${participantsUrl(taskId)}/${users.memberB.id}`).expect(404);
      await api('leaderA').delete(`${participantsUrl(taskId)}/nao-e-um-id`).expect(404);
      const events = await history(taskId);
      expect(events[events.length - 1]).toEqual(
        expect.objectContaining({ event_type: 'participant_removed', old_value: { userId: users.memberB.id }, new_value: null, author_id: users.leaderA.id }),
      );
    });

    it('RN38 — numa tarefa eliminada, elegíveis, participantes e atribuições respondem 404', async () => {
      const taskId = await newTask();
      await t.db.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [taskId]);
      await api('leaderA').get(`/api/tasks/${taskId}/eligible-users`).expect(404);
      await api('leaderA').get(participantsUrl(taskId)).expect(404);
      await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA.id }).expect(404);
      await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA.id }).expect(404);
    });
  });

  it('Ex. 6 — o responsável e os participantes mantêm-se depois de reabrir uma tarefa entregue (RN26)', async () => {
    const taskId = await newTask({ state: 'delivered' });
    await api('leaderA').patch(`/api/tasks/${taskId}`, { assigneeId: users.memberA.id }).expect(200);
    await api('leaderA').post(participantsUrl(taskId), { userId: users.memberA2.id }).expect(201);
    await api('leaderA').post(`/api/tasks/${taskId}/state`, { state: 'in_development' }).expect(200);
    const res = await api('memberA').get(`/api/tasks/${taskId}`).expect(200);
    expect(res.body).toMatchObject({ state: 'in_development', assignee: { id: users.memberA.id } });
    expect(res.body.participants.map((p: { user: { id: string } }) => p.user.id)).toEqual([users.memberA2.id]);
  });
});
