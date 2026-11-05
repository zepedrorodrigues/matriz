/**
 * Fuso horário da aplicação: decide o «fim do dia» das sprints (RN36) e quando um prazo fica
 * ultrapassado (RN29, RF28). Europe/Lisbon por omissão, configurável em APP_TIME_ZONE (F19).
 */
export function appTimeZone(): string {
  const tz = process.env.APP_TIME_ZONE || 'Europe/Lisbon';
  // Só nomes IANA (letras, números, «/», «_», «+», «-»), para o valor poder entrar numa expressão SQL.
  if (!/^[A-Za-z0-9_+\-/]+$/.test(tz)) throw new Error(`APP_TIME_ZONE inválido: ${tz}`);
  return tz;
}

/** Expressão SQL do dia de hoje no fuso da aplicação. */
export const todaySql = () => `(now() AT TIME ZONE '${appTimeZone()}')::date`;
