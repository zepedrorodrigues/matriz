/**
 * Regras do quadro da sprint (DT17, direção «B · Quadro»): o que acontece quando um cartão é largado numa
 * coluna, ou movido pelo menu «Mover para…» (a alternativa por teclado, RNF12). As regras são as de sempre
 * — RN26 (ciclo de vida), RN27 (estimativa para planear), RN36/RN37 (só o líder planeia e retira) —; a
 * API continua a decidir e responde 403/409 com o motivo. Sem importações relativas com efeitos: testado
 * com node:test.
 */
// Com extensão: o node:test resolve o ficheiro diretamente (tsconfig: allowImportingTsExtensions, noEmit).
import { STATE_LABEL, TASK_STATES, type TaskState } from './tasks.ts';

export const BACKLOG = 'backlog' as const;
export type ColumnId = typeof BACKLOG | TaskState;

export type BoardMove =
  | { kind: 'none' }
  | { kind: 'plan' }
  | { kind: 'remove' }
  | { kind: 'state'; to: TaskState }
  | { kind: 'refuse'; reason: string };

export interface DropContext {
  /** Coluna de onde o cartão sai e onde é largado. */
  from: ColumnId;
  to: ColumnId;
  /** Estado atual da tarefa (no backlog, o cartão também tem estado). */
  state: TaskState;
  /** Estados para onde este utilizador pode levar a tarefa (stateTargetsFor). */
  targets: readonly TaskState[];
  /** Líder da equipa com a sprint aberta: planeia e retira tarefas (RN36, RN37). */
  mayPlan: boolean;
  /** Motivo por que a tarefa do backlog não pode ser planeada (RN27, concluída, noutra sprint). */
  notPlannableReason?: string;
}

/** O que acontece ao largar um cartão numa coluna. */
export function resolveDrop(c: DropContext): BoardMove {
  if (c.from === c.to) return { kind: 'none' };

  if (c.from === BACKLOG) {
    if (!c.mayPlan) return { kind: 'refuse', reason: 'Só o líder da equipa planeia tarefas na sprint.' };
    if (c.notPlannableReason) return { kind: 'refuse', reason: c.notPlannableReason };
    // Planear não muda o estado: a tarefa entra na sprint na coluna do seu estado atual.
    return { kind: 'plan' };
  }

  if (c.to === BACKLOG) {
    return c.mayPlan ? { kind: 'remove' } : { kind: 'refuse', reason: 'Só o líder da equipa retira tarefas da sprint.' };
  }

  if (c.targets.includes(c.to)) return { kind: 'state', to: c.to };
  return { kind: 'refuse', reason: refusalReason(c.state, c.to, c.targets) };
}

/** Explicação de uma mudança de estado recusada, nos termos de RN26. */
export function refusalReason(state: TaskState, to: TaskState, targets: readonly TaskState[]): string {
  if (targets.length === 0) return 'Não pode mudar o estado desta tarefa: só o responsável, nas tarefas que lhe estão atribuídas, e o líder o fazem.';
  if (state === 'delivered') return 'Uma tarefa «Entregue» só pode ser reaberta para «A desenvolver».';
  const next = TASK_STATES[TASK_STATES.indexOf(state) + 1];
  if (TASK_STATES.indexOf(to) > TASK_STATES.indexOf(state)) {
    return next && targets.includes(next)
      ? `Avança-se um estado de cada vez: o seguinte é «${STATE_LABEL[next]}».`
      : `Não pode levar a tarefa para «${STATE_LABEL[to]}».`;
  }
  return `Não pode levar a tarefa para «${STATE_LABEL[to]}».`;
}

/** Opções do menu «Mover para…» de um cartão: as mesmas que o arrasto aceitaria. */
export function moveOptions(c: Omit<DropContext, 'to'>): { to: ColumnId; label: string }[] {
  const options: { to: ColumnId; label: string }[] = [];
  if (c.from === BACKLOG) {
    if (c.mayPlan && !c.notPlannableReason) options.push({ to: c.state, label: 'Planear na sprint' });
    return options;
  }
  for (const s of c.targets) options.push({ to: s, label: `Mover para «${STATE_LABEL[s]}»` });
  if (c.mayPlan) options.push({ to: BACKLOG, label: 'Devolver ao backlog' });
  return options;
}
