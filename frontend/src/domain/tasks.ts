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

/** RN07: escala comum e fixa de story points. */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;

/**
 * RN10, RN24: «depois de entrar em A desenvolver» conta o estado atual (decisão do humano, 2026-11-05).
 * Nestes estados, só o líder, o gestor e o administrador alteram as estimativas e os critérios.
 */
export const DEVELOPMENT_STATES: readonly TaskState[] = ['in_development', 'in_testing', 'done', 'delivered'];

/** RN13: numa tarefa «Terminada» ou «Entregue» não se acrescentam critérios nem se desmarca o cumprimento. */
export const FINISHED_STATES: readonly TaskState[] = ['done', 'delivered'];

export const HOURS_MESSAGE = 'Indique as horas entre 0 e 9999,99, com até duas casas decimais (p. ex. 8 ou 7,5).';
export const CRITERION_MESSAGE = 'A descrição do critério é obrigatória e não pode ter só espaços.';

/**
 * Horas escritas no campo (aceita vírgula ou ponto): vazio → `null` (sem estimativa); inválido →
 * `undefined`. Os mesmos limites da API: de 0 a 9999,99, com até duas casas decimais.
 */
export function parseEstimateHours(text: string): number | null | undefined {
  const value = text.trim();
  if (value === '') return null;
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(value)) return undefined;
  return Number(value.replace(',', '.'));
}

/** Horas como se escrevem em pt-PT (vírgula decimal), para mostrar e para preencher o campo. */
export const formatHours = (hours: number) => String(hours).replace('.', ',');

/** CA06.7: a descrição de um critério é obrigatória e não pode ter só espaços. */
export const validateCriterionText = (text: string) => (text.trim() === '' ? CRITERION_MESSAGE : undefined);

/**
 * RN03, CA09.6: escolher alguém que não está entre os elegíveis da equipa responsável exige uma
 * justificação. Sem utilizador escolhido (retirar o responsável), não.
 */
export const needsJustification = (userId: string, teamUserIds: readonly string[]) =>
  userId !== '' && !teamUserIds.includes(userId);

export const COMMENT_MESSAGE = 'O comentário tem de ter entre 1 e 2000 caracteres e não pode ter só espaços.';

/** CA10.3, RN41: as mesmas regras da API, contadas depois de retirar os espaços no início e no fim. */
export function validateCommentText(text: string): string | undefined {
  const length = text.trim().length;
  return length < 1 || length > 2000 ? COMMENT_MESSAGE : undefined;
}

/** Página onde fica o comentário número `total` (o mais recente), por ordem cronológica (CA10.2). */
export const lastPage = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

export const BLOCK_REASON_MESSAGE = 'Descreva o impedimento ao trabalho (até 2000 caracteres), nunca motivos pessoais.';

/** RN28, SEC06: ao bloquear, o motivo é obrigatório, não só espaços, até 2000 caracteres. */
export function validateBlockReason(text: string): string | undefined {
  const length = text.trim().length;
  return length < 1 || length > 2000 ? BLOCK_REASON_MESSAGE : undefined;
}
