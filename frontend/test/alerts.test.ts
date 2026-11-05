/**
 * Apresentação dos alertas (CA05.8, CA07.5, CA07.7, CA07.8, CA08.2). A API decide quem recebe cada alerta
 * (backend/test/alerts.e2e-spec.ts). Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { alertsNavLabel, describeAlert, type AlertView } from '../src/domain/alerts.ts';

const base: AlertView = { type: 'task_blocked', task: { title: 'T', isBlocked: true, blockReason: 'Sem acesso' }, team: null, member: null, dueDate: null };

test('CA07.7 — prazo ultrapassado com a data em pt-PT', () => {
  assert.deepEqual(describeAlert({ ...base, type: 'deadline_passed', dueDate: '2026-11-04' }), {
    title: 'Prazo ultrapassado',
    detail: 'O prazo era 04/11/2026 e a tarefa não está concluída.',
  });
});

test('CA07.5 — bloqueio com o motivo atual; desbloqueada entretanto', () => {
  assert.equal(describeAlert(base).detail, 'Motivo: Sem acesso');
  assert.equal(describeAlert({ ...base, task: { title: 'T', isBlocked: false, blockReason: null } }).detail, 'Entretanto, a tarefa foi desbloqueada.');
});

test('tarefa eliminada: o alerta mantém-se, sem a tarefa', () => {
  for (const type of ['deadline_passed', 'task_blocked', 'task_reopened', 'member_task_created'] as const) {
    assert.equal(describeAlert({ ...base, type, task: null }).detail, 'A tarefa já não está disponível.');
  }
});

test('CA05.8, RN19 — sobrecarga da equipa e de uma pessoa, com os nomes', () => {
  assert.equal(describeAlert({ ...base, type: 'team_overload', task: null, team: { name: 'Alfa' } }).detail, 'O trabalho planeado da equipa Alfa excede a capacidade da sprint.');
  assert.equal(
    describeAlert({ ...base, type: 'individual_overload', task: null, team: { name: 'Alfa' }, member: { name: 'Rui' } }).detail,
    'O trabalho atribuído a Rui excede as suas horas disponíveis na sprint.',
  );
});

test('navegação: número de alertas por ler, só quando há', () => {
  assert.equal(alertsNavLabel(0), 'Alertas');
  assert.equal(alertsNavLabel(3), 'Alertas (3)');
});
