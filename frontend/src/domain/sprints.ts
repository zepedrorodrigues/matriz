/**
 * Regras das sprints repetidas na interface (US04; RN06, RN31, RN36): as mesmas da API, para responder
 * antes do pedido. Sem importações relativas, para ser testado diretamente com node:test.
 */
export type SprintStatus = 'planned' | 'active' | 'closed';

/** RN36 */
export const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = { planned: 'Planeada', active: 'Ativa', closed: 'Terminada' };

export const DATES_MESSAGE = 'A data de fim tem de ser igual ou posterior à de início (RN31).';

/** RN06: dias úteis (segunda a sexta) entre duas datas AAAA-MM-DD, inclusive; 0 se as datas forem inválidas. */
export function workingDays(startDate: string, endDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 0;
  const day = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(end.getTime())) return 0;
  let count = 0;
  while (day <= end) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return count;
}

/** RN31: as duas datas indicadas e o início igual ou anterior ao fim. */
export function validateSprintDates(input: { startDate: string; endDate: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.startDate) errors.startDate = 'Indique a data de início.';
  if (!input.endDate) errors.endDate = 'Indique a data de fim.';
  if (input.startDate && input.endDate && input.startDate > input.endDate) errors.endDate = DATES_MESSAGE;
  return errors;
}

/** Data AAAA-MM-DD apresentada em pt-PT (sem conversões de fuso: é uma data de calendário). */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
