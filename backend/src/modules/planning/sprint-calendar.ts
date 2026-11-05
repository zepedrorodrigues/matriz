/**
 * Calendário do planeamento: o fuso horário que decide o «fim do dia» (RN36; decisão do humano, F19:
 * Europe/Lisbon, configurável em APP_TIME_ZONE) e os dias úteis de uma sprint (RN06: segunda a sexta,
 * sem descontar feriados).
 */
export { appTimeZone as planningTimeZone } from '../../shared/config/time-zone';

/** Dias úteis entre duas datas AAAA-MM-DD, inclusive. */
export function workingDays(startDate: string, endDate: string): number {
  const day = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  let count = 0;
  while (day <= end) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return count;
}
