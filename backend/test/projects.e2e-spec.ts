import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I2 — Gestão de projetos (Ficha PL 03, Ex. 4): US01 CA01.2, CA01.6, CA01.8, CA01.14–CA01.17, CAT06,
 * RN25/D48 (quem cria), RN38 (eliminação lógica), RN32 (histórico), D46 (paginação).
 */
describe('I2 — projetos', () => {
  let t: TestApp;
  let fx: Fixtures;

  type U = { id: string; email: string; name: string };
  let admin: U, leader: U, member: U, manager: U, outsider: U;
  let teamId: string;
  let tokens: Record<'admin' | 'leader' | 'member' | 'manager' | 'outsider', string>;

  const api = (token: string) => ({
    get: (url: string) => request(t.server).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object) => request(t.server).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => request(t.server).patch(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => request(t.server).delete(url).set('Authorization', `Bearer ${token}`),
  });

  const row = async (id: string) => {
    const [r] = await t.db.query(`SELECT name, objective, deleted_at FROM organization.project WHERE id = $1`, [id]);
    return r as { name: string; objective: string | null; deleted_at: Date | null } | undefined;
  };
  const projectCount = async () => (await t.db.query(`SELECT count(*)::int AS n FROM organization.project`))[0].n as number;
  const history = (id: string) =>
    t.db.query(
      `SELECT event_type, old_value, new_value, author_id FROM history.history_event
       WHERE entity_type = 'project' AND entity_id = $1 ORDER BY id`,
      [id],
    );

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    admin = await fx.user('Admin', { isAdmin: true });
    leader = await fx.user('Lider');
    member = await fx.user('Membro');
    manager = await fx.user('Gestor');
    outsider = await fx.user('Fora');
    teamId = await fx.team('Equipa', [
      { userId: leader.id, role: 'leader' },
      { userId: member.id, role: 'member' },
    ]);
    tokens = {
      admin: await t.token({ email: admin.email }),
      leader: await t.token({ email: leader.email }),
      member: await t.token({ email: member.email }),
      manager: await t.token({ email: manager.email }),
      outsider: await t.token({ email: outsider.email }),
    };
  });

  afterAll(async () => {
    await t.close();
  });

  describe('CA01.2 — criar um projeto (RN25, D48)', () => {
    it('CA01.2 — o líder de equipa cria; fica gestor (vindo do token); o nome é guardado sem espaços nas pontas', async () => {
      const res = await api(tokens.leader).post('/api/projects', { name: '  Portal Alfa  ', objective: 'Objetivo do portal' }).expect(201);
      expect(res.body).toMatchObject({
        name: 'Portal Alfa',
        objective: 'Objetivo do portal',
        managers: [{ id: leader.id, name: 'Lider' }],
        teams: [],
      });
      expect((await row(res.body.id))?.name).toBe('Portal Alfa');

      // Consta da lista do criador e é consultável depois.
      const list = await api(tokens.leader).get('/api/projects?q=portal alfa').expect(200);
      expect(list.body.items.map((p: { id: string }) => p.id)).toContain(res.body.id);
      await api(tokens.leader).get(`/api/projects/${res.body.id}`).expect(200);

      // RN32: a criação fica no histórico, com o autor do token.
      const events = await history(res.body.id);
      expect(events).toEqual([
        expect.objectContaining({ event_type: 'created', old_value: null, author_id: leader.id }),
      ]);
    });

    it('CA01.2 — o administrador cria um projeto sem objetivo', async () => {
      const res = await api(tokens.admin).post('/api/projects', { name: 'Projeto do admin' }).expect(201);
      expect(res.body).toMatchObject({ objective: null, managers: [{ id: admin.id }] });
    });

    it('RN25, D48 — membro, gestor sem liderança e utilizador sem equipa recebem 403 e nada é criado', async () => {
      const before = await projectCount();
      for (const who of ['member', 'manager', 'outsider'] as const) {
        const res = await api(tokens[who]).post('/api/projects', { name: `Recusado ${who}` });
        expect(res.status).toBe(403);
        expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
      }
      expect(await projectCount()).toBe(before);
    });

    it('Ex. 3.3 — o gestor não pode ser indicado no pedido (campo desconhecido → 400)', async () => {
      const before = await projectCount();
      const res = await api(tokens.leader).post('/api/projects', { name: 'Com gestor', managerId: outsider.id }).expect(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'managerId' })]));
      expect(await projectCount()).toBe(before);
    });
  });

  describe('CA01.17 — validar o nome e o objetivo', () => {
    it.each([
      ['nome em falta', {}],
      ['nome vazio', { name: '' }],
      ['nome só com espaços', { name: '     ' }],
      ['nome com 2 caracteres depois de retirar espaços', { name: '  ab  ' }],
      ['nome com 101 caracteres', { name: 'x'.repeat(101) }],
      ['nome que não é texto', { name: 123 }],
      ['objetivo com 1001 caracteres', { name: 'Válido', objective: 'y'.repeat(1001) }],
    ])('CA01.17 — %s → 400 e o projeto não é criado', async (_label, body) => {
      const before = await projectCount();
      const res = await api(tokens.leader).post('/api/projects', body).expect(400);
      expect(res.body).toMatchObject({ status: 400, errors: expect.any(Array) });
      expect(res.body.errors.length).toBeGreaterThan(0);
      expect(await projectCount()).toBe(before);
    });

    it('CA01.17 — limites aceites: nome com 3 e com 100 caracteres, objetivo com 1000', async () => {
      await api(tokens.leader).post('/api/projects', { name: 'abc' }).expect(201);
      await api(tokens.leader).post('/api/projects', { name: 'n'.repeat(100), objective: 'o'.repeat(1000) }).expect(201);
    });

    it('CA01.17 — edição inválida → 400 e o projeto não é alterado', async () => {
      const { body } = await api(tokens.leader).post('/api/projects', { name: 'Para validar', objective: 'Original' }).expect(201);
      await api(tokens.leader).patch(`/api/projects/${body.id}`, { name: '   ' }).expect(400);
      await api(tokens.leader).patch(`/api/projects/${body.id}`, { objective: 'z'.repeat(1001) }).expect(400);
      await api(tokens.leader).patch(`/api/projects/${body.id}`, {}).expect(400);
      expect(await row(body.id)).toMatchObject({ name: 'Para validar', objective: 'Original' });
    });
  });

  describe('CA01.6 — editar um projeto', () => {
    it('CA01.6 — o gestor altera o nome e o objetivo; as equipas mantêm-se; o histórico guarda os valores', async () => {
      const id = await fx.project('Antes', { managers: [manager.id], teams: [teamId] });
      const res = await api(tokens.manager).patch(`/api/projects/${id}`, { name: 'Depois', objective: 'Novo objetivo' }).expect(200);
      expect(res.body).toMatchObject({ name: 'Depois', objective: 'Novo objetivo', teams: [{ id: teamId, active: true }] });
      const again = await api(tokens.manager).get(`/api/projects/${id}`).expect(200);
      expect(again.body).toMatchObject({ name: 'Depois', objective: 'Novo objetivo' });
      expect(await history(id)).toEqual([
        expect.objectContaining({
          event_type: 'updated',
          old_value: { name: 'Antes', objective: null },
          new_value: { name: 'Depois', objective: 'Novo objetivo' },
          author_id: manager.id,
        }),
      ]);
    });

    it('CA01.6 — o administrador edita qualquer projeto; objetivo vazio remove o objetivo (F12)', async () => {
      const id = await fx.project('Do gestor', { managers: [manager.id] });
      await api(tokens.admin).patch(`/api/projects/${id}`, { objective: 'Algo' }).expect(200);
      const res = await api(tokens.admin).patch(`/api/projects/${id}`, { objective: '   ' }).expect(200);
      expect(res.body.objective).toBeNull();
      expect((await row(id))?.objective).toBeNull();
    });

    it('§3.1, CAT02 — líder e membro de uma equipa associada veem o projeto mas não o editam (403, sem alterações)', async () => {
      const id = await fx.project('Só leitura', { managers: [manager.id], teams: [teamId] });
      await api(tokens.leader).get(`/api/projects/${id}`).expect(200);
      await api(tokens.leader).patch(`/api/projects/${id}`, { name: 'Alterado pelo líder' }).expect(403);
      await api(tokens.member).patch(`/api/projects/${id}`, { name: 'Alterado pelo membro' }).expect(403);
      expect((await row(id))?.name).toBe('Só leitura');
      expect(await history(id)).toEqual([]);
    });
  });

  describe('CA01.8, CA01.14, CAT06 — listar, pesquisar e paginar só os projetos visíveis', () => {
    let visibleToMember: string[];

    beforeAll(async () => {
      visibleToMember = [
        await fx.project('Zeta Interno', { teams: [teamId] }),
        await fx.project('alfa interno', { teams: [teamId] }),
        await fx.project('Beta INTERNO', { teams: [teamId] }),
      ];
      await fx.project('Interno de outra equipa', { managers: [manager.id] });
      await fx.project('Interno eliminado', { teams: [teamId], deleted: true });
    });

    it('CAT06 — o membro vê só os projetos da sua equipa, ordenados pelo nome; o administrador vê todos', async () => {
      const res = await api(tokens.member).get('/api/projects?q=interno').expect(200);
      expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['alfa interno', 'Beta INTERNO', 'Zeta Interno']);
      expect(res.body.total).toBe(3);
      expect(res.body.items.map((p: { id: string }) => p.id).sort()).toEqual([...visibleToMember].sort());
      expect(res.body.items[0]).toEqual({
        id: expect.any(String),
        name: 'alfa interno',
        objective: null,
        createdAt: expect.any(String),
      });

      const asAdmin = await api(tokens.admin).get('/api/projects?q=interno').expect(200);
      expect(asAdmin.body.total).toBe(4); // inclui o de outra equipa; nunca o eliminado (RN38)
    });

    it('CA01.14 — a pesquisa ignora maiúsculas e trata % e _ como texto', async () => {
      const res = await api(tokens.member).get('/api/projects?q=INTER').expect(200);
      expect(res.body.total).toBe(3);
      const literal = await api(tokens.member).get('/api/projects?q=%25').expect(200);
      expect(literal.body.total).toBe(0);
    });

    it('D46 — paginação: total do conjunto filtrado, não só da página', async () => {
      const p1 = await api(tokens.member).get('/api/projects?q=interno&page=1&pageSize=2').expect(200);
      expect(p1.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
      expect(p1.body.items).toHaveLength(2);
      const p2 = await api(tokens.member).get('/api/projects?q=interno&page=2&pageSize=2').expect(200);
      expect(p2.body.items.map((p: { name: string }) => p.name)).toEqual(['Zeta Interno']);
      const defaults = await api(tokens.member).get('/api/projects').expect(200);
      expect(defaults.body).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('D46 — parâmetros inválidos → 400', async () => {
      await api(tokens.member).get('/api/projects?page=0').expect(400);
      await api(tokens.member).get('/api/projects?pageSize=101').expect(400);
      await api(tokens.member).get('/api/projects?page=abc').expect(400);
      await api(tokens.member).get(`/api/projects?q=${'q'.repeat(101)}`).expect(400);
    });

    it('CAT06 — consultar um projeto não visível → 403; inexistente, eliminado ou id mal formado → 404', async () => {
      const other = await fx.project('Privado', { managers: [manager.id] });
      const deleted = await fx.project('Apagado', { teams: [teamId], deleted: true });
      await api(tokens.member).get(`/api/projects/${other}`).expect(403);
      await api(tokens.outsider).get(`/api/projects/${visibleToMember[0]}`).expect(403);
      await api(tokens.member).get(`/api/projects/${deleted}`).expect(404);
      await api(tokens.member).get('/api/projects/00000000-0000-4000-8000-000000000000').expect(404);
      await api(tokens.member).get('/api/projects/nao-e-um-uuid').expect(404);
    });
  });

  describe('CA01.15, CA01.16 — eliminar um projeto (RN38)', () => {
    it('CA01.15 — o gestor elimina: sai de listagens, pesquisas e consultas; a linha mantém-se; o histórico regista', async () => {
      const id = await fx.project('Para eliminar', { managers: [manager.id], teams: [teamId] });
      await api(tokens.manager).delete(`/api/projects/${id}`).expect(204);

      expect((await row(id))?.deleted_at).toBeInstanceOf(Date); // eliminação lógica, sem órfãos
      await api(tokens.manager).get(`/api/projects/${id}`).expect(404);
      await api(tokens.manager).patch(`/api/projects/${id}`, { name: 'Ressuscitado' }).expect(404);
      await api(tokens.manager).delete(`/api/projects/${id}`).expect(404);
      const list = await api(tokens.admin).get('/api/projects?q=para eliminar').expect(200);
      expect(list.body.total).toBe(0);
      expect(await history(id)).toEqual([
        expect.objectContaining({
          event_type: 'deleted',
          old_value: { name: 'Para eliminar', objective: null },
          new_value: null,
          author_id: manager.id,
        }),
      ]);
    });

    it('CA01.16 — líder, membro e utilizador sem acesso não eliminam (403) e o projeto mantém-se', async () => {
      const id = await fx.project('Protegido', { managers: [manager.id], teams: [teamId] });
      await api(tokens.leader).delete(`/api/projects/${id}`).expect(403);
      await api(tokens.member).delete(`/api/projects/${id}`).expect(403);
      await api(tokens.outsider).delete(`/api/projects/${id}`).expect(403);
      expect((await row(id))?.deleted_at).toBeNull();
      expect(await history(id)).toEqual([]);
    });

    it('CA01.15 — o administrador elimina qualquer projeto', async () => {
      const id = await fx.project('Do admin para eliminar', { managers: [manager.id] });
      await api(tokens.admin).delete(`/api/projects/${id}`).expect(204);
    });
  });

  it('Ex. 8 (caso 08) — mudar o identificador no pedido não dá acesso a projetos de outros', async () => {
    const mine = await fx.project('Do gestor', { managers: [manager.id] });
    const theirs = await fx.project('De outra pessoa', { managers: [admin.id] });
    await api(tokens.manager).get(`/api/projects/${mine}`).expect(200);
    await api(tokens.manager).get(`/api/projects/${theirs}`).expect(403);
    await api(tokens.manager).patch(`/api/projects/${theirs}`, { name: 'Tomado' }).expect(403);
    await api(tokens.manager).delete(`/api/projects/${theirs}`).expect(403);
    expect(await row(theirs)).toMatchObject({ name: 'De outra pessoa', deleted_at: null });
  });

  it('CAT01 — sem token, as operações de projetos respondem 401', async () => {
    await request(t.server).get('/api/projects').expect(401);
    await request(t.server).post('/api/projects').send({ name: 'Anónimo' }).expect(401);
  });
});
