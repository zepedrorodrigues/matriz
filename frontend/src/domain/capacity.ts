/**
 * Apresentação da capacidade (US05; RN06, RN19): as horas nunca se convertem em story points e a
 * sobrecarga é assinalada sem impedir o planeamento. Sem importações relativas, para ser testado com
 * node:test.
 */
export const hoursText = (hours: number) => `${String(Math.round(hours * 100) / 100).replace('.', ',')} h`;

/** Diferença entre a capacidade e o planeado: o que resta ou quanto excede (RN19). */
export function remainingText(remaining: number): string {
  if (remaining === 0) return 'sem horas de folga';
  return remaining > 0 ? `restam ${hoursText(remaining)}` : `excede em ${hoursText(-remaining)}`;
}

export const AVAILABILITY_MESSAGE = 'Indique as horas entre 0 e 9999,99, com até duas casas decimais.';

/** Horas disponíveis escritas no campo (vírgula ou ponto); `undefined` se forem inválidas. */
export function parseAvailability(text: string): number | undefined {
  const value = text.trim();
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(value)) return undefined;
  return Number(value.replace(',', '.'));
}
