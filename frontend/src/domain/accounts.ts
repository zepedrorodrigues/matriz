/**
 * Regras das contas de utilizador repetidas na interface (CA01.13): as mesmas da API, para responder
 * antes do pedido. Sem importações relativas, para ser testado diretamente com node:test.
 */
export const ACCOUNT_NAME_MESSAGE = 'O nome é obrigatório, não pode ter só espaços e tem até 100 caracteres.';
export const ACCOUNT_EMAIL_MESSAGE = 'Indique um e-mail profissional válido.';

/** Verificação simples do formato; a API valida o e-mail por completo. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAccount(input: { name: string; workEmail: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 1 || name.length > 100) errors.name = ACCOUNT_NAME_MESSAGE;
  const email = input.workEmail.trim();
  if (email.length > 254 || !EMAIL.test(email)) errors.workEmail = ACCOUNT_EMAIL_MESSAGE;
  return errors;
}

/** Estado da conta apresentado ao administrador (RN35: ligada no primeiro acesso). */
export const accountStatus = (a: { active: boolean; linked: boolean }) =>
  !a.active ? 'Desativada' : a.linked ? 'Ligada' : 'Por ligar (ainda não acedeu)';
