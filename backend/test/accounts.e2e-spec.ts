import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Fixtures, TestApp } from './support/test-app';

/** I3, passo 1 — Contas de utilizador: CA01.13 (criação e ligação no primeiro acesso), RN35, §3.1. */
describe('I3 — contas de utilizador', () => {
  let t: TestApp;
  let fx: Fixtures;
  let adminToken: string, leaderToken: string, managerToken: string;

  const users = () => request(t.server);
  const count = async () => (await t.db.query(`SELECT count(*)::int AS n FROM identity."user"`))[0].n as number;

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
    const admin = await fx.user('Admin', { isAdmin: true });
    const leader = await fx.user('Lider');
    const manager = await fx.user('Gestor');
    await fx.team('Equipa', [{ userId: leader.id, role: 'leader' }]);
    await fx.project('Projeto', { managers: [manager.id] });
    adminToken = await t.token({ email: admin.email });
    leaderToken = await t.token({ email: leader.email });
    managerToken = await t.token({ email: manager.email });
  });

  afterAll(async () => {
    await t.close();
  });

  it('CA01.13, RN35 — o administrador cria uma conta: fica ativa, por ligar, sem papel de administrador nem equipas', async () => {
    const email = `nova.${randomUUID().slice(0, 8)}@matriz.example`;
    const res = await users()
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  Nova Colaboradora  ', workEmail: `  ${email}  ` })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Nova Colaboradora',
      workEmail: email,
      isAdmin: false,
      active: true,
      linked: false,
      createdAt: expect.any(String),
    });
    const [row] = await t.db.query(`SELECT external_subject, is_admin FROM identity."user" WHERE id = $1`, [res.body.id]);
    expect(row).toEqual({ external_subject: null, is_admin: false });
  });

  it('CA01.13 — no primeiro acesso, a conta criada liga-se à identidade pelo e-mail verificado (sem distinguir maiúsculas) e passa a «ligada»', async () => {
    const email = `ligar.${randomUUID().slice(0, 8)}@matriz.example`;
    const created = await users().post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Por ligar', workEmail: email }).expect(201);
    const sub = randomUUID();
    const token = await t.token({ sub, email: email.toUpperCase() });
    const me = await users().get('/api/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body).toMatchObject({ id: created.body.id, name: 'Por ligar', isAdmin: false, teams: [] });
    expect(await fx.externalSubjectOf(created.body.id)).toBe(sub);
    const list = await users().get(`/api/users?q=${encodeURIComponent(email)}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(list.body.items).toEqual([expect.objectContaining({ id: created.body.id, linked: true })]);
  });

  it('CA01.13 — e-mail já usado (sem distinguir maiúsculas) → 409; nada é criado', async () => {
    const email = `repetido.${randomUUID().slice(0, 8)}@matriz.example`;
    await users().post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Primeira', workEmail: email }).expect(201);
    const before = await count();
    const res = await users()
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Segunda', workEmail: email.toUpperCase() })
      .expect(409);
    expect(res.body.detail).toContain('e-mail');
    expect(await count()).toBe(before);
  });

  it('Validação — nome vazio, só espaços ou com mais de 100 caracteres, e-mail inválido e campos desconhecidos → 400', async () => {
    const before = await count();
    const post = (body: object) => users().post('/api/users').set('Authorization', `Bearer ${adminToken}`).send(body);
    for (const name of ['', '   ', 'n'.repeat(101)]) {
      const res = await post({ name, workEmail: 'valido@matriz.example' }).expect(400);
      expect(res.body.errors[0].field).toBe('name');
    }
    for (const workEmail of ['', 'sem-arroba', 'a@', `${'x'.repeat(250)}@matriz.example`]) {
      const res = await post({ name: 'Nome', workEmail }).expect(400);
      expect(res.body.errors[0].field).toBe('workEmail');
    }
    await post({ name: 'Nome', workEmail: 'outro@matriz.example', isAdmin: true }).expect(400);
    expect(await count()).toBe(before);
    // Limite: 100 caracteres depois de retirar os espaços.
    await post({ name: ` ${'n'.repeat(100)} `, workEmail: `limite.${randomUUID().slice(0, 8)}@matriz.example` }).expect(201);
  });

  it('§3.1 — o líder e o gestor não criam nem listam contas (403, nada criado)', async () => {
    const before = await count();
    for (const token of [leaderToken, managerToken]) {
      await users().post('/api/users').set('Authorization', `Bearer ${token}`).send({ name: 'X', workEmail: 'x@matriz.example' }).expect(403);
      await users().get('/api/users').set('Authorization', `Bearer ${token}`).expect(403);
    }
    await users().get('/api/users').expect(401);
    expect(await count()).toBe(before);
  });

  it('D46 — a listagem pesquisa pelo nome ou pelo e-mail, ordena pelo nome e devolve o total do conjunto pesquisado', async () => {
    const tag = randomUUID().slice(0, 6);
    for (const name of [`Zé ${tag}`, `Ana ${tag}`, `Marta ${tag}`]) {
      await users().post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name, workEmail: `${name.split(' ')[0].toLowerCase()}.${tag}@matriz.example` }).expect(201);
    }
    const res = await users().get(`/api/users?q=${tag.toUpperCase()}&pageSize=2`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(res.body.items.map((u: { name: string }) => u.name)).toEqual([`Ana ${tag}`, `Marta ${tag}`]);
    const byEmail = await users().get(`/api/users?q=marta.${tag}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(byEmail.body.total).toBe(1);
    await users().get('/api/users?pageSize=101').set('Authorization', `Bearer ${adminToken}`).expect(400);
  });
});
