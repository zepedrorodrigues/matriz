/**
 * Valores técnicos das tarefas acordados com a API (openapi.yaml: TaskState, Priority) e a sua
 * apresentação em pt-PT. A Ficha PL 03 permite traduzir na interface, mantendo os valores da API.
 * Sem importações relativas, para ser testado diretamente com node:test.
 */
export const TASK_STATES = [
  'in_planning',
  'in_technical_analysis',
  'ready_for_development',
  'in_development',
  'in_testing',
  'done',
  'delivered',
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** RN17 */
export const STATE_LABEL: Record<TaskState, string> = {
  in_planning: 'Em planeamento',
  in_technical_analysis: 'Em análise técnica',
  ready_for_development: 'Pronto a desenvolver',
  in_development: 'A desenvolver',
  in_testing: 'Em testes',
  done: 'Terminada',
  delivered: 'Entregue',
};

/** RN39 */
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

/**
 * Estados para onde a tarefa pode ir segundo o ciclo de vida (RN26): o seguinte e qualquer anterior;
 * de «Entregue», só «A desenvolver» (reabertura). Os critérios de aceitação (RN27, RN13) e as
 * permissões são verificados pela API, que responde 409 ou 403 com o motivo.
 */
export function lifecycleTargets(state: TaskState): TaskState[] {
  if (state === 'delivered') return ['in_development'];
  const index = TASK_STATES.indexOf(state);
  const next = TASK_STATES[index + 1];
  return [...(next ? [next] : []), ...TASK_STATES.slice(0, index).reverse()];
}

/** RN26: o membro move as tarefas que lhe estão atribuídas entre «Pronto a desenvolver» e «Terminada». */
export const MEMBER_STATES: readonly TaskState[] = ['ready_for_development', 'in_development', 'in_testing', 'done'];

export const TITLE_MESSAGE = 'O título tem de ter entre 3 e 150 caracteres, sem contar os espaços no início e no fim.';
export const DESCRIPTION_MESSAGE = 'A descrição pode ter até 2000 caracteres.';

/** As mesmas regras da API (RN42, CA03.18), repetidas na interface para responder antes do pedido. */
export function validateTaskText(input: { title: string; description: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = input.title.trim().length;
  if (title < 3 || title > 150) errors.title = TITLE_MESSAGE;
  if (input.description.trim().length > 2000) errors.description = DESCRIPTION_MESSAGE;
  return errors;
}
