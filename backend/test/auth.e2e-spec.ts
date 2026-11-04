import { randomUUID } from 'node:crypto';
import { generateKeyPair } from 'jose';
import request from 'supertest';
import { AccessService } from '../src/modules/identity/access.service';
import { Fixtures, TestApp } from './support/test-app';

/**
 * I1 — Acesso à aplicação (Ficha PL 03, Ex. 3): autenticação por token OIDC (DT04), ligação da conta
 * no primeiro acesso (RN35, CA01.13) e matriz de permissões (§3.1, CAT01, CAT02, CAT06).
 */
describe('I1 — acesso à aplicação', () => {
  let t: TestApp;
  let fx: Fixtures;

  beforeAll(async () => {
    t = await TestApp.create();
    fx = new Fixtures(t.db);
  });

  afterAll(async () => {
    await t.close();
  });

  const me = (token?: string) => {
    const req = request(t.server).get('/api/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const expectProblem = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({ type: 'about:blank', status, instance: '/api/me' });
    expect(typeof res.body.title).toBe('string');
  };

  describe('CAT01 — acesso apenas autenticado', () => {
    it('CAT01 — sem token responde 401 com problem+json e WWW-Authenticate: Bearer', async () => {
      const res = await me();
      expectProblem(res, 401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    });

    it('CAT01 — cabeçalho Authorization que não é Bearer responde 401', async () => {
      expectProblem(await request(t.server).get('/api/me').set('Authorization', 'Basic YWJjOmRlZg=='), 401);
    });

    it('CAT01 — token mal formado responde 401', async () => {
      expectProblem(await me('isto-nao-e-um-jwt'), 401);
    });

    it('CAT01 — token assinado com outra chave responde 401', async () => {
      const user = await fx.user('Assinatura');
      const { privateKey } = await generateKeyPair('RS256');
      expectProblem(await me(await t.token({ email: user.email }, { key: privateKey })), 401);
    });

    it('CAT01 — token de outro emissor responde 401', async () => {
      const user = await fx.user('Emissor');
      expectProblem(await me(await t.token({ email: user.email }, { issuer: 'http://localhost:9999/realms/outro' })), 401);
    });

    it('CAT01 — token para outra audiência responde 401', async () => {
      const user = await fx.user('Audiencia');
      expectProblem(await me(await t.token({ email: user.email }, { audience: 'outra-api' })), 401);
    });

    it('CAT01 — token expirado responde 401', async () => {
      const user = await fx.user('Expirado');
      const expired = await t.token({ email: user.email }, { expiresIn: Math.floor(Date.now() / 1000) - 60 });
      expectProblem(await me(expired), 401);
    });

    it('CAT01 — o health continua acessível sem token', async () => {
      await request(t.server).get('/api/health').expect(200);
    });
  });

  describe('Token válido sem conta ativa na Matriz', () => {
    it('CAT02 — e-mail sem conta (como a conta sem-conta do Keycloak) responde 403', async () => {
      expectProblem(await me(await t.token({ email: `sem-conta.${randomUUID()}@matriz.example` })), 403);
    });

    it('SEC09 — conta desativada responde 403', async () => {
      const user = await fx.user('Desativada', { active: false });
      expectProblem(await me(await t.token({ email: user.email })), 403);
    });

    it('RN35 — e-mail não verificado pelo fornecedor não liga a conta e responde 403', async () => {
      const user = await fx.user('NaoVerificado');
      expectProblem(await me(await t.token({ email: user.email, email_verified: false })), 403);
      expect(await fx.externalSubjectOf(user.id)).toBeNull();
    });
  });

  describe('CA01.13 — ligação da conta no primeiro acesso (RN35)', () => {
    it('CA01.13 — o primeiro acesso liga a conta pelo e-mail e guarda o sub; os seguintes usam o sub', async () => {
      const user = await fx.user('Primeiro');
      const sub = randomUUID();

      const first = await me(await t.token({ sub, email: user.email.toUpperCase() })).expect(200);
      expect(first.body.id).toBe(user.id);
      expect(await fx.externalSubjectOf(user.id)).toBe(sub);

      // Mesmo sub com outro e-mail no token: continua a ser a mesma conta (a identidade é o sub).
      const next = await me(await t.token({ sub, email: 'outro.email@matriz.example' })).expect(200);
      expect(next.body.id).toBe(user.id);
    });

    it('CA01.13 — uma conta já ligada a outra identidade não é ligada de novo (403)', async () => {
      const user = await fx.user('JaLigada', { externalSubject: randomUUID() });
      expectProblem(await me(await t.token({ sub: randomUUID(), email: user.email })), 403);
    });
  });

  describe('Dois utilizadores com acessos diferentes', () => {
    let leader: { id: string; email: string; name: string };
    let manager: { id: string; email: string; name: string };
    let outsider: { id: string; email: string; name: string };
    let admin: { id: string; email: string; name: string };
    let teamId: string;
    let projectP: string;
    let projectQ: string;
    let deletedProject: string;

    beforeAll(async () => {
      leader = await fx.user('Lider');
      manager = await fx.user('Gestor');
      outsider = await fx.user('Fora');
      admin = await fx.user('Admin', { isAdmin: true });
      teamId = await fx.team('Equipa', [{ userId: leader.id, role: 'leader' }]);
      projectP = await fx.project('Projeto P', { managers: [manager.id], teams: [teamId] });
      projectQ = await fx.project('Projeto Q', { managers: [admin.id] });
      deletedProject = await fx.project('Projeto eliminado', { managers: [manager.id], teams: [teamId], deleted: true });
    });

    it('§3.1 — /me devolve a conta e os papéis de cada utilizador, a partir do token', async () => {
      const asLeader = await me(await t.token({ email: leader.email })).expect(200);
      expect(asLeader.body).toEqual({
        id: leader.id,
        name: 'Lider',
        workEmail: leader.email,
        isAdmin: false,
        teams: [{ teamId, teamName: expect.stringMatching(/^Equipa /), role: 'leader', allocationPct: 100 }],
        managedProjectIds: [],
      });

      const asManager = await me(await t.token({ email: manager.email })).expect(200);
      expect(asManager.body).toMatchObject({ id: manager.id, isAdmin: false, teams: [], managedProjectIds: [projectP] });

      const asAdmin = await me(await t.token({ email: admin.email })).expect(200);
      expect(asAdmin.body).toMatchObject({ id: admin.id, isAdmin: true });
    });

    it('CAT06 — cada utilizador só vê os projetos das suas equipas ou que gere; o administrador vê todos', async () => {
      const access = t.app.get(AccessService);
      const as = (u: { id: string }, isAdmin = false) => ({ id: u.id, isAdmin });

      await expect(access.canViewProject(as(leader), projectP)).resolves.toBe(true);
      await expect(access.canViewProject(as(leader), projectQ)).resolves.toBe(false);
      await expect(access.canViewProject(as(manager), projectP)).resolves.toBe(true);
      await expect(access.canViewProject(as(manager), projectQ)).resolves.toBe(false);
      await expect(access.canViewProject(as(outsider), projectP)).resolves.toBe(false);
      await expect(access.canViewProject(as(admin, true), projectP)).resolves.toBe(true);
      await expect(access.canViewProject(as(admin, true), projectQ)).resolves.toBe(true);
      // RN38: um projeto eliminado deixa de ser visível para membros e gestores.
      await expect(access.canViewProject(as(leader), deletedProject)).resolves.toBe(false);
      await expect(access.canViewProject(as(manager), deletedProject)).resolves.toBe(false);
    });
  });
});
