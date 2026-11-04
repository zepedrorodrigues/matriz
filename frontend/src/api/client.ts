/**
 * Cliente da API. O endereço base fica centralizado aqui: em desenvolvimento o Vite encaminha
 * /api para o backend e em produção o proxy faz o mesmo (mesma origem, architecture.md §8).
 * O token de acesso (DT04) é acrescentado no I1.
 */
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new ApiError(res.status, `Pedido ${path} falhou com o código ${res.status}.`);
  return (await res.json()) as T;
}

/** openapi.yaml: Health */
export interface Health {
  status: 'ok' | 'unavailable';
  database: 'ok' | 'unavailable';
}

export const getHealth = () => apiGet<Health>('/health');
