import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

/** O que o registo usa do pedido e da resposta HTTP (evita depender dos tipos do Express). */
export interface LoggedRequest {
  method: string;
  url: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface LoggedResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  on(event: 'finish', listener: () => void): unknown;
}

/** Uma linha por pedido. Só estes campos: nunca o corpo, o token, a query nem dados de utilizadores. */
export interface RequestLogEntry {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

export interface RequestLogSink {
  log(entry: RequestLogEntry): unknown;
  error(entry: RequestLogEntry): unknown;
}

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Aceita o identificador do proxy se for curto e sem caracteres estranhos; senão, gera um. */
export function requestIdFrom(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}

/**
 * Registo dos pedidos (DT20): método, caminho, código de resposta, duração e um identificador que
 * também vai na resposta (`X-Request-Id`), para ligar o pedido aos registos do proxy.
 *
 * - O caminho vai sem a query: as pesquisas (`?search=`) podem ter nomes de pessoas (SEC07).
 * - As verificações de saúde bem-sucedidas não se registam: são vários pedidos por minuto e instância.
 * - Os erros do servidor (5xx) registam-se como erro; o resto, como informação.
 */
export function requestLog(
  sink: RequestLogSink = new Logger('Pedido'),
  now: () => number = () => performance.now(),
): (req: LoggedRequest, res: LoggedResponse, next: () => void) => void {
  return (req, res, next) => {
    const start = now();
    const requestId = requestIdFrom(req.headers[REQUEST_ID_HEADER]);
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      const path = (req.originalUrl ?? req.url).split('?')[0];
      const status = res.statusCode;
      if (status < 400 && path.startsWith('/api/health')) return;
      const entry: RequestLogEntry = {
        requestId,
        method: req.method,
        path,
        status,
        durationMs: Math.round(now() - start),
      };
      if (status >= 500) sink.error(entry);
      else sink.log(entry);
    });
    next();
  };
}
