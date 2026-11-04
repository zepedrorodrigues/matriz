import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Carrega o `.env` local da raiz do repositório (fora do Git, SEC08), sem substituir variáveis
 * já definidas no ambiente. Os comandos npm do backend correm em `backend/`; a raiz é a pasta acima.
 * Em produção não há `.env`: as variáveis vêm do ambiente do contentor.
 */
export function loadRootEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
    if (!existsSync(candidate)) continue;
    const values = parseEnv(readFileSync(candidate, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
    }
    return;
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta a variável de ambiente ${name} (ver .env.example).`);
  return value;
}
