import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { IdentityProviderProbe } from '../src/shared/health/identity-provider.probe';
import { RequestLogEntry } from '../src/shared/logging/request-log';

describe('I0 — GET /api/health', () => {
  let app: INestApplication;
  // O fornecedor de identidade não corre nos testes de API: a sua disponibilidade é decidida aqui.
  let identityProviderUp = true;
  const logged: RequestLogEntry[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentityProviderProbe)
      .useValue({ isAvailable: async () => identityProviderUp })
      .compile();
    app = configureApp(moduleRef.createNestApplication(), {
      requestLog: { log: (e) => logged.push(e), error: (e) => logged.push(e) },
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    identityProviderUp = true;
    logged.length = 0;
  });

  it('I0 — responde 200 com o serviço e a base de dados disponíveis, sem token', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('DT20 — /api/health/live responde 200 sem token', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('DT20 — /api/health/ready responde 200 com a base de dados real e o fornecedor de identidade disponível', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok', identityProvider: 'ok' });
  });

  it('DT20 — /api/health/ready responde 503 sem o fornecedor de identidade; /api/health mantém-se 200', async () => {
    identityProviderUp = false;
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
    expect(res.body).toEqual({ status: 'unavailable', database: 'ok', identityProvider: 'unavailable' });
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('DT20 — cada pedido leva X-Request-Id e fica registado sem a query nem o token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/projects?search=Ana%20Exemplo')
      .set('Authorization', 'Bearer nao-e-um-token')
      .set('X-Request-Id', 'teste-123')
      .expect(401);
    expect(res.headers['x-request-id']).toBe('teste-123');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ requestId: 'teste-123', method: 'GET', path: '/api/projects', status: 401 });
    expect(JSON.stringify(logged)).not.toMatch(/Ana|nao-e-um-token/);
  });

  it('DT20 — as verificações de saúde bem-sucedidas não enchem o registo; a que falha fica registada', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(logged).toEqual([]);
    identityProviderUp = false;
    await request(app.getHttpServer()).get('/api/health/ready').expect(503);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ path: '/api/health/ready', status: 503 });
  });
});
