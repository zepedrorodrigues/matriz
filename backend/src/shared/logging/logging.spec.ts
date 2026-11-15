import { EventEmitter } from 'node:events';
import { createAppLogger, logFormat } from './app-logger';
import { LoggedRequest, LoggedResponse, requestIdFrom, requestLog, RequestLogEntry } from './request-log';

describe('DT20 — formato dos registos (LOG_FORMAT)', () => {
  it('sem LOG_FORMAT: JSON em produção, texto fora dela', () => {
    expect(logFormat({ NODE_ENV: 'production' })).toBe('json');
    expect(logFormat({ NODE_ENV: 'development' })).toBe('text');
    expect(logFormat({})).toBe('text');
  });

  it('LOG_FORMAT decide, com maiúsculas ou espaços; um valor desconhecido é ignorado', () => {
    expect(logFormat({ NODE_ENV: 'production', LOG_FORMAT: 'text' })).toBe('text');
    expect(logFormat({ NODE_ENV: 'development', LOG_FORMAT: ' JSON ' })).toBe('json');
    expect(logFormat({ NODE_ENV: 'production', LOG_FORMAT: 'xml' })).toBe('json');
  });

  it('em JSON, cada registo é uma linha JSON com nível, contexto, data e a mensagem por campos', () => {
    const lines: string[] = [];
    const write = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      createAppLogger({ LOG_FORMAT: 'json' }).log({ method: 'GET', status: 200 }, 'Pedido');
    } finally {
      write.mockRestore();
    }
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('\n')).toBe(true);
    const record = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(record).toMatchObject({ level: 'log', context: 'Pedido', message: { method: 'GET', status: 200 } });
    expect(typeof record.timestamp).toBe('number');
  });
});

describe('DT20 — registo dos pedidos', () => {
  class FakeResponse extends EventEmitter implements LoggedResponse {
    statusCode = 200;
    headers: Record<string, string> = {};
    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    }
  }

  function run(req: Partial<LoggedRequest>, status: number, elapsedMs = 12) {
    const logged: RequestLogEntry[] = [];
    const errors: RequestLogEntry[] = [];
    let clock = 1000;
    const middleware = requestLog(
      { log: (e) => logged.push(e), error: (e) => errors.push(e) },
      () => clock,
    );
    const res = new FakeResponse();
    let nextCalled = false;
    middleware({ method: 'GET', url: '/', headers: {}, ...req }, res, () => {
      nextCalled = true;
    });
    clock += elapsedMs;
    res.statusCode = status;
    res.emit('finish');
    return { logged, errors, res, nextCalled };
  }

  it('regista método, caminho, código, duração e o identificador que vai na resposta', () => {
    const { logged, errors, res, nextCalled } = run({ method: 'POST', originalUrl: '/api/projects/7/tasks' }, 201, 34);
    expect(nextCalled).toBe(true);
    expect(errors).toEqual([]);
    expect(logged).toEqual([
      { requestId: res.headers['X-Request-Id'], method: 'POST', path: '/api/projects/7/tasks', status: 201, durationMs: 34 },
    ]);
    expect(res.headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('SEC07 — a query não é registada (as pesquisas podem ter nomes)', () => {
    const { logged } = run({ originalUrl: '/api/users?search=Ana%20Exemplo&page=2' }, 200);
    expect(logged[0].path).toBe('/api/users');
    expect(JSON.stringify(logged)).not.toContain('Ana');
  });

  it('só regista os campos previstos: nem cabeçalhos, nem o token', () => {
    const { logged } = run({ originalUrl: '/api/me', headers: { authorization: 'Bearer segredo' } }, 200);
    expect(Object.keys(logged[0]).sort()).toEqual(['durationMs', 'method', 'path', 'requestId', 'status']);
    expect(JSON.stringify(logged)).not.toContain('segredo');
  });

  it('os erros do servidor (5xx) registam-se como erro; os 4xx, como informação', () => {
    expect(run({ originalUrl: '/api/tasks/1' }, 500).errors).toHaveLength(1);
    expect(run({ originalUrl: '/api/tasks/1' }, 503).logged).toHaveLength(0);
    const notFound = run({ originalUrl: '/api/tasks/1' }, 404);
    expect(notFound.logged).toHaveLength(1);
    expect(notFound.errors).toHaveLength(0);
  });

  it('as verificações de saúde bem-sucedidas não se registam; as que falham, sim', () => {
    for (const path of ['/api/health', '/api/health/live', '/api/health/ready']) {
      const ok = run({ originalUrl: path }, 200);
      expect(ok.logged).toEqual([]);
      expect(ok.res.headers['X-Request-Id']).toBeDefined();
    }
    expect(run({ originalUrl: '/api/health/ready' }, 503).errors).toHaveLength(1);
  });

  it('aceita o identificador do proxy se for seguro; senão, gera um novo', () => {
    expect(requestIdFrom('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(requestIdFrom(['proxy-1', 'outro'])).toBe('proxy-1');
    for (const unsafe of [undefined, '', 'com espaço', 'linha\nnova', '<script>', 'x'.repeat(65)]) {
      expect(requestIdFrom(unsafe)).toMatch(/^[0-9a-f-]{36}$/);
    }
    const { logged, res } = run({ originalUrl: '/api/me', headers: { 'x-request-id': 'proxy-42' } }, 200);
    expect(logged[0].requestId).toBe('proxy-42');
    expect(res.headers['X-Request-Id']).toBe('proxy-42');
  });
});
