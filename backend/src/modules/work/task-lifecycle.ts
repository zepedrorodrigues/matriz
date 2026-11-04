import { TASK_STATES, type TaskState } from '../../shared/ports/work-item-locator';

export interface CriteriaStatus {
  total: number;
  met: number;
}

export type Transition =
  | { allowed: true; kind: 'advance' | 'back' | 'reopen' }
  | { allowed: false; reason: string };

const LABEL: Record<TaskState, string> = {
  in_planning: 'Em planeamento',
  in_technical_analysis: 'Em análise técnica',
  ready_for_development: 'Pronto a desenvolver',
  in_development: 'A desenvolver',
  in_testing: 'Em testes',
  done: 'Terminada',
  delivered: 'Entregue',
};

/**
 * Transições do ciclo de vida (RN26), independentes de quem as pede (a permissão é avaliada antes,
 * pela matriz §3.1):
 * - avança-se um estado de cada vez, pela ordem de RN17, e recua-se para qualquer estado anterior;
 * - «Pronto a desenvolver» exige pelo menos um critério de aceitação (RN27);
 * - «Terminada» exige todos os critérios cumpridos (RN13); «Entregue» só a partir de «Terminada»;
 * - de «Entregue» só se sai por reabertura, para «A desenvolver».
 */
export function checkTransition(from: TaskState, to: TaskState, criteria: CriteriaStatus): Transition {
  if (from === to) return { allowed: false, reason: `A tarefa já está em «${LABEL[to]}».` };

  if (from === 'delivered') {
    return to === 'in_development'
      ? { allowed: true, kind: 'reopen' }
      : { allowed: false, reason: 'Uma tarefa entregue só sai de «Entregue» por reabertura, para «A desenvolver».' };
  }

  const fromIndex = TASK_STATES.indexOf(from);
  const toIndex = TASK_STATES.indexOf(to);
  if (toIndex < fromIndex) return { allowed: true, kind: 'back' };
  if (toIndex > fromIndex + 1) {
    return {
      allowed: false,
      reason: `Avança-se um estado de cada vez: a seguir a «${LABEL[from]}» vem «${LABEL[TASK_STATES[fromIndex + 1]]}».`,
    };
  }
  if (to === 'ready_for_development' && criteria.total === 0) {
    return { allowed: false, reason: 'Para passar a «Pronto a desenvolver», a tarefa precisa de pelo menos um critério de aceitação.' };
  }
  if (to === 'done' && criteria.met < criteria.total) {
    return { allowed: false, reason: 'Só fica «Terminada» com todos os critérios de aceitação cumpridos.' };
  }
  return { allowed: true, kind: 'advance' };
}
