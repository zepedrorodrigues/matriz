/**
 * Histórico (I13, D50, RN32): frase de cada tipo de evento, nomes das referências, valores retirados (SEC07,
 * CAT06) e tipos desconhecidos. Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { describeEvent, omittedNote, type HistoryEventView } from '../src/domain/history.ts';

const ev = (key: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null, extra: Partial<HistoryEventView> = {}): HistoryEventView => {
  const [entityType, eventType] = key.split(':');
  return { entityType, eventType, oldValue, newValue, references: {}, omitted: [], ...extra };
};
const GENERIC = /^Alteração registada/;

/** Um exemplo de cada tipo publicado pelo backend (database.md §2.6). */
const KNOWN: HistoryEventView[] = [
  ev('task:created', null, { title: 'T' }),
  ev('task:updated', { title: 'A' }, { title: 'B' }),
  ev('task:estimate_changed', { estimateHours: null }, { estimateHours: 7.5 }),
  ev('task:assignee_changed', { assigneeId: null }, { assigneeId: 'u1' }),
  ev('task:participant_added', null, { userId: 'u1' }),
  ev('task:participant_removed', { userId: 'u1' }, null),
  ev('task:state_changed', { state: 'in_planning' }, { state: 'in_technical_analysis' }),
  ev('task:reopened', { state: 'delivered' }, { state: 'in_development' }),
  ev('task:due_date_changed', { dueDate: null }, { dueDate: '2026-12-01' }),
  ev('task:blocked', { isBlocked: false }, { isBlocked: true, blockReason: 'À espera' }),
  ev('task:unblocked', { isBlocked: true }, { isBlocked: false, blockReason: null }),
  ev('task:block_reason_changed', {}, { isBlocked: true, blockReason: 'Outro' }),
  ev('task:deleted', { title: 'T' }, null),
  ev('task:team_transferred', { teamId: 'a', assigneeId: null }, { teamId: 'b', originalTeamId: 'a' }),
  ev('acceptance_criterion:created', null, { taskId: 't', description: 'C', isMet: false }),
  ev('acceptance_criterion:criterion_changed', { isMet: false }, { taskId: 't', isMet: true }),
  ev('sprint:created', null, { startDate: '2026-01-05', endDate: '2026-01-16' }),
  ev('sprint:dates_changed', {}, { startDate: '2026-01-05', endDate: '2026-01-16' }),
  ev('sprint:started', {}, { status: 'active', startDate: '2026-01-05', endDate: '2026-01-16', taskIds: [] }),
  ev('sprint:task_planned', null, { taskId: 't' }),
  ev('sprint:task_added', null, { taskId: 't' }),
  ev('sprint:task_removed', { taskId: 't' }, { taskId: 't' }),
  ev('sprint:closed', { status: 'active' }, { status: 'closed', returnedToBacklog: ['t'] }),
  ev('sprint:availability_adjusted', { userId: 'u1', availableHours: null }, { userId: 'u1', availableHours: 30 }),
  ev('sprint:availability_reset', { userId: 'u1', availableHours: 30 }, { userId: 'u1', availableHours: null }),
  ev('team:created', null, { name: 'Alfa', leaderId: 'u1' }),
  ev('team:updated', { name: 'A' }, { name: 'B' }),
  ev('team:deactivated', { active: true }, { active: false }),
  ev('team:member_added', null, { userId: 'u1', role: 'member', allocationPct: 50 }),
  ev('team:member_updated', { userId: 'u1', role: 'member', allocationPct: 50 }, { userId: 'u1', role: 'leader', allocationPct: 60 }),
  ev('team:member_removed', { userId: 'u1', role: 'member', allocationPct: 50 }, null),
  ev('project:created', null, { name: 'P', managerId: 'u1' }),
  ev('project:updated', { name: 'A' }, { name: 'B' }),
  ev('project:team_added', null, { teamId: 'a', teamName: 'Alfa' }),
  ev('project:deleted', { name: 'P' }, null),
  ev('objective:created', null, { projectId: 'p', title: 'O' }),
  ev('epic:created', null, { objectiveId: 'o', title: 'E' }),
];

test('RN32: cada tipo de evento conhecido tem uma frase própria, terminada em ponto', () => {
  for (const event of KNOWN) {
    const text = describeEvent(event);
    assert.doesNotMatch(text, GENERIC, `${event.entityType}:${event.eventType}`);
    assert.match(text, /\.$/, `${event.entityType}:${event.eventType}: ${text}`);
  }
});

test('RN32: um tipo desconhecido mostra-se como alteração genérica, com o tipo — nunca desaparece', () => {
  assert.equal(describeEvent(ev('task:novo_tipo', null, { x: 1 })), 'Alteração registada (novo_tipo).');
  assert.equal(describeEvent(ev('outro:created', null, null)), 'Alteração registada (created).');
});

test('CA06.6, CA09.2: a transferência nomeia a equipa anterior, a nova e a original; a saída do responsável nomeia-o', () => {
  const references = { a: 'Equipa Azul', b: 'Equipa Verde', c: 'Equipa Rosa', u1: 'Ana' };
  assert.equal(
    describeEvent(ev('task:team_transferred', { teamId: 'a', assigneeId: 'u1' }, { teamId: 'b', originalTeamId: 'a' }, { references })),
    'Transferiu a tarefa da equipa «Equipa Azul» para «Equipa Verde» (equipa original: «Equipa Azul»).',
  );
  // RN14, RN32: na segunda passagem, a equipa original continua a ser a primeira, não a anterior.
  assert.equal(
    describeEvent(ev('task:team_transferred', { teamId: 'b', assigneeId: null }, { teamId: 'c', originalTeamId: 'a' }, { references })),
    'Transferiu a tarefa da equipa «Equipa Verde» para «Equipa Rosa» (equipa original: «Equipa Azul»).',
  );
  assert.equal(
    describeEvent(ev('task:assignee_changed', { assigneeId: 'u1' }, { assigneeId: null, reason: 'transferred' }, { references })),
    'Ana deixou de ser responsável, com a transferência para outra equipa.',
  );
});

test('RN03: a atribuição a alguém de outra equipa mostra a justificação', () => {
  const event = ev('task:assignee_changed', { assigneeId: null }, { assigneeId: 'u1', crossTeam: true, justification: 'Especialista' }, { references: { u1: 'Rui' } });
  assert.equal(describeEvent(event), 'Atribuiu a tarefa a Rui, de outra equipa («Especialista»).');
});

test('CA06.5: a reabertura e a mudança de estado usam os nomes dos estados', () => {
  assert.equal(describeEvent(KNOWN[7]), 'Reabriu a tarefa: de «Entregue» para «A desenvolver».');
  assert.equal(describeEvent(KNOWN[6]), 'Mudou o estado de «Em planeamento» para «Em análise técnica».');
});

test('SEC07: sem a alocação ou as horas (retiradas pela API), a frase não mostra números e há aviso', () => {
  const member = ev('team:member_added', null, { userId: 'u1', role: 'member' }, { references: { u1: 'Ana' }, omitted: ['allocationPct'] });
  assert.equal(describeEvent(member), 'Acrescentou Ana como membro.');
  assert.ok(omittedNote(member));
  const hours = ev('sprint:availability_adjusted', { userId: 'u1' }, { userId: 'u1' }, { references: { u1: 'Ana' }, omitted: ['availableHours'] });
  assert.equal(describeEvent(hours), 'Ajustou as horas disponíveis de Ana.');
  assert.equal(describeEvent(KNOWN[28]), 'Acrescentou um utilizador como membro (50 %).');
  assert.equal(omittedNote(KNOWN[28]), undefined);
});

test('CAT06: uma tarefa retirada do evento não é nomeada', () => {
  const hidden = ev('sprint:task_planned', null, {}, { omitted: ['taskId', 'estimateHours', 'storyPoints'] });
  assert.equal(describeEvent(hidden), 'Planeou uma tarefa a que não tem acesso na sprint.');
  assert.equal(describeEvent(ev('sprint:task_planned', null, { taskId: 't' }, { references: { t: 'Login' } })), 'Planeou «Login» na sprint.');
  assert.equal(
    describeEvent(ev('sprint:closed', null, { returnedToBacklog: ['t'] }, { references: { t: 'Login' } })),
    'A sprint terminou; voltaram ao backlog: «Login».',
  );
});
