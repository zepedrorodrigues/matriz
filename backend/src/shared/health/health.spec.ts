import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { IdentityProviderProbe } from './identity-provider.probe';

describe('DT13, DT20 — verificações de saúde', () => {
  function controller(databaseUp: boolean, identityProviderUp: boolean) {
    const queries: string[] = [];
    const dataSource = {
      query: async (sql: string) => {
        queries.push(sql);
        if (!databaseUp) throw new Error('ligação recusada');
        return [{ '?column?': 1 }];
      },
    } as unknown as DataSource;
    const probe = { isAvailable: async () => identityProviderUp } as IdentityProviderProbe;
    const statuses: number[] = [];
    const res = { status: (code: number) => statuses.push(code) };
    return { c: new HealthController(dataSource, probe), res, statuses, queries };
  }

  it('live: responde ok sem tocar na base de dados nem no fornecedor de identidade', () => {
    const { c, queries } = controller(false, false);
    expect(c.getLiveness()).toEqual({ status: 'ok' });
    expect(queries).toEqual([]);
  });

  it('ready: 200 quando a base de dados e o fornecedor de identidade respondem', async () => {
    const { c, res, statuses } = controller(true, true);
    expect(await c.getReadiness(res)).toEqual({ status: 'ok', database: 'ok', identityProvider: 'ok' });
    expect(statuses).toEqual([]);
  });

  it('ready: 503 sem a base de dados, a dizer qual das duas falhou', async () => {
    const { c, res, statuses } = controller(false, true);
    expect(await c.getReadiness(res)).toEqual({ status: 'unavailable', database: 'unavailable', identityProvider: 'ok' });
    expect(statuses).toEqual([503]);
  });

  it('ready: 503 sem o fornecedor de identidade, com a base de dados disponível', async () => {
    const { c, res, statuses } = controller(true, false);
    expect(await c.getReadiness(res)).toEqual({ status: 'unavailable', database: 'ok', identityProvider: 'unavailable' });
    expect(statuses).toEqual([503]);
  });

  it('health: não depende do fornecedor de identidade (é a verificação que o Docker e o compose usam)', async () => {
    const up = controller(true, false);
    expect(await up.c.getHealth(up.res)).toEqual({ status: 'ok', database: 'ok' });
    expect(up.statuses).toEqual([]);
    const down = controller(false, true);
    expect(await down.c.getHealth(down.res)).toEqual({ status: 'unavailable', database: 'unavailable' });
    expect(down.statuses).toEqual([503]);
  });
});

describe('DT20 — disponibilidade do fornecedor de identidade', () => {
  const ISSUER = 'http://idp.exemplo/realms/matriz';
  let previous: string | undefined;

  beforeAll(() => {
    previous = process.env.OIDC_ISSUER;
    process.env.OIDC_ISSUER = ISSUER;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.OIDC_ISSUER;
    else process.env.OIDC_ISSUER = previous;
  });

  function probe(answer: () => Promise<{ ok: boolean }>) {
    const urls: string[] = [];
    const clock = { now: 0 };
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return answer();
    }) as unknown as typeof fetch;
    return { p: new IdentityProviderProbe(fetchImpl, () => clock.now), urls, clock };
  }

  it('pergunta pela descoberta OIDC do emissor configurado', async () => {
    const { p, urls } = probe(async () => ({ ok: true }));
    expect(await p.isAvailable()).toBe(true);
    expect(urls).toEqual([`${ISSUER}/.well-known/openid-configuration`]);
  });

  it('indisponível quando responde com erro ou quando o pedido falha', async () => {
    expect(await probe(async () => ({ ok: false })).p.isAvailable()).toBe(false);
    expect(
      await probe(async () => {
        throw new Error('sem rede');
      }).p.isAvailable(),
    ).toBe(false);
  });

  it('guarda o resultado 30 s e volta a perguntar depois', async () => {
    let up = true;
    const { p, urls, clock } = probe(async () => ({ ok: up }));
    expect(await p.isAvailable()).toBe(true);
    up = false;
    clock.now = 29_999;
    expect(await p.isAvailable()).toBe(true);
    expect(urls).toHaveLength(1);
    clock.now = 30_000;
    expect(await p.isAvailable()).toBe(false);
    expect(urls).toHaveLength(2);
  });
});
