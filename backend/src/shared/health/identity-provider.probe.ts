import { requireEnv } from '../config/load-env';

const TIMEOUT_MS = 2000;
const CACHE_MS = 30_000;

/**
 * Disponibilidade do fornecedor de identidade (DT04, DT20): a descoberta OIDC do emissor responde?
 * Sem ela, uma instância acabada de arrancar não consegue obter as chaves para validar tokens.
 *
 * O resultado guarda-se 30 s, para as verificações de prontidão (vários pedidos por minuto) não
 * carregarem o fornecedor; cada pedido tem um limite de 2 s.
 *
 * Registado no módulo raiz por uma fábrica (os parâmetros do construtor são só para os testes).
 */
export class IdentityProviderProbe {
  private last?: { at: number; available: boolean };

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async isAvailable(): Promise<boolean> {
    if (this.last && this.now() - this.last.at < CACHE_MS) return this.last.available;
    let available: boolean;
    try {
      const res = await this.fetchImpl(`${requireEnv('OIDC_ISSUER')}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      available = res.ok;
    } catch {
      available = false;
    }
    this.last = { at: this.now(), available };
    return available;
  }
}
