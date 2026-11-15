import { ConsoleLogger } from '@nestjs/common';

export type LogFormat = 'json' | 'text';

/**
 * Formato dos registos (DT20): `LOG_FORMAT=json` ou `text`. Sem a variável, JSON em produção (o
 * `NODE_ENV` da imagem), para os registos poderem ser recolhidos e pesquisados por campo, e texto
 * no desenvolvimento, para se lerem no terminal.
 */
export function logFormat(env: NodeJS.ProcessEnv = process.env): LogFormat {
  const chosen = env.LOG_FORMAT?.trim().toLowerCase();
  if (chosen === 'json' || chosen === 'text') return chosen;
  return env.NODE_ENV === 'production' ? 'json' : 'text';
}

/** Logger da aplicação: o do NestJS, com uma linha JSON por registo quando o formato é `json`. */
export function createAppLogger(env: NodeJS.ProcessEnv = process.env): ConsoleLogger {
  return logFormat(env) === 'json' ? new ConsoleLogger({ json: true, colors: false }) : new ConsoleLogger();
}
