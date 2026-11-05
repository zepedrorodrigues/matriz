/**
 * Regras das sprints repetidas na interface (RN06, RN31). A API aplica as mesmas regras
 * (backend/test/sprints.e2e-spec.ts). Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDate, validateSprintDates, workingDays } from '../src/domain/sprints.ts';

test('RN06 — dias úteis de segunda a sexta, inclusive', () => {
  assert.equal(workingDays('2030-01-07', '2030-01-18'), 10);
  assert.equal(workingDays('2030-01-05', '2030-01-06'), 0);
  assert.equal(workingDays('2030-01-07', '2030-01-07'), 1);
  assert.equal(workingDays('', '2030-01-07'), 0);
});

test('RN31 — datas em falta ou início depois do fim são recusados', () => {
  assert.ok(validateSprintDates({ startDate: '', endDate: '2030-01-07' }).startDate);
  assert.ok(validateSprintDates({ startDate: '2030-01-10', endDate: '2030-01-07' }).endDate);
  assert.deepEqual(validateSprintDates({ startDate: '2030-01-07', endDate: '2030-01-07' }), {});
});

test('Datas de calendário em pt-PT', () => {
  assert.equal(formatDate('2030-01-07'), '07/01/2030');
});
