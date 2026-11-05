/**
 * Regras das pertenças repetidas na interface (CA01.9, RN06, RN21, RN34; F18): as mesmas da API, para
 * responder antes do pedido. Sem importações relativas, para ser testado diretamente com node:test.
 */
export interface AllocationRow {
  teamId: string;
  allocationPct: string;
}

export const ALLOCATION_MESSAGE = 'Indique um número inteiro de 1 a 100.';

/** Alocação escrita no campo: inteiro de 1 a 100, ou `undefined` se for inválida. */
export function parseAllocation(text: string): number | undefined {
  const value = text.trim();
  if (!/^\d{1,3}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 && n <= 100 ? n : undefined;
}

/** Soma das alocações válidas (as inválidas contam como 0). */
export const allocationTotal = (rows: readonly AllocationRow[]) =>
  rows.reduce((sum, r) => sum + (parseAllocation(r.allocationPct) ?? 0), 0);

/**
 * Erros por linha (índice) e erro geral: cada alocação de 1 a 100, sem equipas repetidas, e a soma
 * igual a 100 — exceto um conjunto vazio, permitido a quem deixa de pertencer a equipas (RN21).
 */
export function validateAllocations(rows: readonly AllocationRow[]): { rows: Record<number, string>; total?: string } {
  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.teamId) errors[i] = 'Escolha a equipa.';
    else if (seen.has(r.teamId)) errors[i] = 'Esta equipa já está na lista.';
    else if (parseAllocation(r.allocationPct) === undefined) errors[i] = ALLOCATION_MESSAGE;
    seen.add(r.teamId);
  });
  const total = allocationTotal(rows);
  return {
    rows: errors,
    total: rows.length > 0 && total !== 100 ? `As alocações têm de somar 100 % (somam ${total} %).` : undefined,
  };
}
