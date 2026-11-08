import { PRIORITY_LABEL, STATE_LABEL, formatHours, type Priority, type TaskState } from './tasks.ts';

/** Evento do histórico como a API o devolve (openapi.yaml: HistoryEvent). */
export interface HistoryEventView {
  entityType: string;
  eventType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  references: Record<string, string>;
  omitted: string[];
}

type Values = Record<string, unknown>;
const ROLE_LABEL: Record<string, string> = { leader: 'líder', member: 'membro' };

const date = (value: unknown) => (typeof value === 'string' ? value.split('-').reverse().join('/') : 'sem data');
const state = (value: unknown) => `«${STATE_LABEL[value as TaskState] ?? String(value)}»`;
const hours = (value: unknown) => (typeof value === 'number' ? `${formatHours(value)} h` : 'sem horas');
const points = (value: unknown) => (typeof value === 'number' ? `${value} SP` : 'sem story points');
const quoted = (value: unknown) => `«${String(value ?? '')}»`;

/**
 * Frase em pt-PT para cada tipo de evento (RN32, D50 §6.4: a API devolve tipos e valores; o texto é da interface).
 * Um tipo que a interface não conheça mostra-se como alteração genérica: nunca desaparece.
 */
export function describeEvent(event: HistoryEventView): string {
  const old: Values = event.oldValue ?? {};
  const now: Values = event.newValue ?? {};
  const name = (id: unknown, fallback: string) => (typeof id === 'string' && event.references[id]) || fallback;
  const person = (id: unknown) => name(id, 'um utilizador');
  const team = (id: unknown) => `«${name(id, 'equipa desconhecida')}»`;
  // CAT06: sem `taskId`, é uma tarefa de um projeto que quem consulta não vê.
  const task = (id: unknown) => (id === undefined ? 'uma tarefa a que não tem acesso' : `«${name(id, 'tarefa eliminada')}»`);
  const tasks = (ids: unknown) => (Array.isArray(ids) ? ids.map(task).join(', ') : '');

  switch (`${event.entityType}:${event.eventType}`) {
    case 'task:created':
      return `Criou a tarefa ${quoted(now.title)}.`;
    case 'task:updated': {
      const parts: string[] = [];
      if ('title' in now) parts.push(`o título para ${quoted(now.title)}`);
      if ('description' in now) parts.push('a descrição');
      if ('priority' in now) {
        parts.push(`a prioridade de ${PRIORITY_LABEL[old.priority as Priority] ?? '—'} para ${PRIORITY_LABEL[now.priority as Priority] ?? '—'}`);
      }
      return `Alterou ${parts.join(', ') || 'a tarefa'}.`;
    }
    case 'task:estimate_changed': {
      const parts: string[] = [];
      if ('estimateHours' in now) parts.push(`horas: ${hours(old.estimateHours)} → ${hours(now.estimateHours)}`);
      if ('storyPoints' in now) parts.push(`story points: ${points(old.storyPoints)} → ${points(now.storyPoints)}`);
      return `Alterou a estimativa (${parts.join('; ')}).`;
    }
    case 'task:assignee_changed':
      if (now.reason === 'transferred') return `${person(old.assigneeId)} deixou de ser responsável, com a transferência para outra equipa.`;
      if (!now.assigneeId) return `Retirou o responsável ${person(old.assigneeId)}.`;
      return `Atribuiu a tarefa a ${person(now.assigneeId)}${now.crossTeam ? `, de outra equipa (${quoted(now.justification)})` : ''}.`;
    case 'task:participant_added':
      return `Acrescentou ${person(now.userId)} aos participantes.`;
    case 'task:participant_removed':
      return `Retirou ${person(old.userId)} dos participantes.`;
    case 'task:state_changed':
      return `Mudou o estado de ${state(old.state)} para ${state(now.state)}.`;
    case 'task:reopened':
      return `Reabriu a tarefa: de ${state(old.state)} para ${state(now.state)}.`;
    case 'task:due_date_changed':
      return now.dueDate ? `Alterou o prazo para ${date(now.dueDate)}.` : 'Retirou o prazo.';
    case 'task:blocked':
      return `Assinalou um bloqueio: ${quoted(now.blockReason)}.`;
    case 'task:unblocked':
      return 'Retirou o bloqueio.';
    case 'task:block_reason_changed':
      return `Alterou o motivo do bloqueio: ${quoted(now.blockReason)}.`;
    case 'task:deleted':
      return 'Eliminou a tarefa.';
    case 'task:team_transferred':
      return `Transferiu a tarefa da equipa ${team(old.teamId)} para ${team(now.teamId)} (equipa original: ${team(now.originalTeamId)}).`;

    case 'acceptance_criterion:created':
      return `Acrescentou o critério de aceitação ${quoted(now.description)}.`;
    case 'acceptance_criterion:criterion_changed': {
      const parts: string[] = [];
      if ('description' in now) parts.push(`alterou o texto de um critério para ${quoted(now.description)}`);
      if (now.isMet === true) parts.push('marcou um critério como cumprido');
      if (now.isMet === false) parts.push('desmarcou um critério');
      const text = parts.join(' e ') || 'alterou um critério de aceitação';
      return `${text[0].toUpperCase()}${text.slice(1)}.`;
    }

    case 'sprint:created':
      return `Criou a sprint de ${date(now.startDate)} a ${date(now.endDate)}.`;
    case 'sprint:dates_changed':
      return `Alterou as datas da sprint para ${date(now.startDate)} a ${date(now.endDate)}.`;
    case 'sprint:started':
      return `Iniciou a sprint (${date(now.startDate)} a ${date(now.endDate)}).`;
    case 'sprint:task_planned':
      return `Planeou ${task(now.taskId)} na sprint.`;
    case 'sprint:task_added':
      return `Acrescentou ${task(now.taskId)} à sprint, depois do início.`;
    case 'sprint:task_removed':
      return now.reason === 'transferred'
        ? `${task(now.taskId)} saiu da sprint por ter sido transferida para outra equipa.`
        : `Retirou ${task(now.taskId)} da sprint.`;
    case 'sprint:closed': {
      const returned = Array.isArray(now.returnedToBacklog) ? now.returnedToBacklog : [];
      return returned.length === 0 ? 'A sprint terminou.' : `A sprint terminou; voltaram ao backlog: ${tasks(returned)}.`;
    }
    case 'sprint:availability_adjusted':
      return 'availableHours' in now
        ? `Ajustou as horas disponíveis de ${person(now.userId)} para ${hours(now.availableHours)}.`
        : `Ajustou as horas disponíveis de ${person(now.userId)}.`;
    case 'sprint:availability_reset':
      return `Repôs o cálculo das horas disponíveis de ${person(now.userId)}.`;

    case 'team:created':
      return `Criou a equipa ${quoted(now.name)}, com ${person(now.leaderId)} como líder.`;
    case 'team:updated':
      return `Mudou o nome da equipa para ${quoted(now.name)}.`;
    case 'team:deactivated':
      return 'Desativou a equipa.';
    case 'team:member_added':
      return `Acrescentou ${person(now.userId)} como ${ROLE_LABEL[now.role as string] ?? 'membro'}${'allocationPct' in now ? ` (${now.allocationPct} %)` : ''}.`;
    case 'team:member_updated': {
      const parts: string[] = [];
      if (old.role !== now.role) parts.push(`passou a ${ROLE_LABEL[now.role as string] ?? 'membro'}`);
      if ('allocationPct' in now && old.allocationPct !== now.allocationPct) parts.push(`alocação de ${old.allocationPct} % para ${now.allocationPct} %`);
      return `Alterou a pertença de ${person(now.userId)}${parts.length ? `: ${parts.join(', ')}` : ''}.`;
    }
    case 'team:member_removed':
      return `Retirou ${person(old.userId)} da equipa.`;

    case 'project:created':
      return `Criou o projeto ${quoted(now.name)}.`;
    case 'project:updated':
      return 'name' in now ? `Alterou o projeto; nome: ${quoted(now.name)}.` : 'Alterou o objetivo do projeto.';
    case 'project:team_added':
      return `Associou a equipa ${quoted(now.teamName)} ao projeto.`;
    case 'project:deleted':
      return 'Eliminou o projeto.';
    case 'objective:created':
      return `Criou o objetivo ${quoted(now.title)}.`;
    case 'epic:created':
      return `Criou o épico ${quoted(now.title)}.`;
  }
  return `Alteração registada (${event.eventType}).`;
}

/** SEC07, CAT06: aviso quando a API retirou valores do evento para quem consulta. */
export const omittedNote = (event: Pick<HistoryEventView, 'omitted'>) =>
  event.omitted.length > 0 ? 'Alguns valores deste registo não estão visíveis para si.' : undefined;
