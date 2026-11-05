/**
 * Apresentação dos alertas (US07; CA05.8, CA07.5, CA07.7, CA07.8, CA08.2; RN18, RN19, RN30). Sem
 * importações relativas, para ser testado com node:test.
 */
export type AlertType = 'deadline_passed' | 'task_blocked' | 'task_reopened' | 'member_task_created' | 'team_overload' | 'individual_overload';

export interface AlertView {
  type: AlertType;
  task: { title: string; isBlocked: boolean; blockReason: string | null } | null;
  team: { name: string } | null;
  member: { name: string } | null;
  dueDate: string | null;
}

const TITLE: Record<AlertType, string> = {
  deadline_passed: 'Prazo ultrapassado',
  task_blocked: 'Tarefa bloqueada',
  task_reopened: 'Tarefa reaberta',
  member_task_created: 'Tarefa criada por um membro da equipa',
  team_overload: 'Equipa em sobrecarga',
  individual_overload: 'Sobrecarga individual',
};

const TASK_TYPES: readonly AlertType[] = ['deadline_passed', 'task_blocked', 'task_reopened', 'member_task_created'];

const calendarDate = (date: string) => date.split('-').reverse().join('/');

/** Título e frase do alerta; a tarefa ou a sprint aparecem como ligação, à parte. */
export function describeAlert(alert: AlertView): { title: string; detail: string } {
  const title = TITLE[alert.type];
  if (TASK_TYPES.includes(alert.type) && !alert.task) return { title, detail: 'A tarefa já não está disponível.' };
  switch (alert.type) {
    case 'deadline_passed':
      return { title, detail: `O prazo era ${calendarDate(alert.dueDate ?? '')} e a tarefa não está concluída.` };
    case 'task_blocked':
      return {
        title,
        detail: alert.task!.isBlocked ? `Motivo: ${alert.task!.blockReason ?? ''}` : 'Entretanto, a tarefa foi desbloqueada.',
      };
    case 'task_reopened':
      return { title, detail: 'A tarefa entregue voltou a «A desenvolver».' };
    case 'member_task_created':
      return { title, detail: 'Uma tarefa nova foi criada na equipa por um membro.' };
    case 'team_overload':
      return { title, detail: `O trabalho planeado da equipa${alert.team ? ` ${alert.team.name}` : ''} excede a capacidade da sprint.` };
    case 'individual_overload':
      return { title, detail: `O trabalho atribuído a ${alert.member?.name ?? 'um membro'} excede as suas horas disponíveis na sprint.` };
  }
}

/** Entrada da navegação, com o número de alertas por ler (wireframe §1). */
export const alertsNavLabel = (unread: number) => (unread > 0 ? `Alertas (${unread})` : 'Alertas');
