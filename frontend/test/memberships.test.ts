/**
 * Regras das pertenças repetidas na interface (CA01.9, RN06; F18). A API aplica as mesmas regras
 * (backend/test/teams.e2e-spec.ts). Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { allocationTotal, parseAllocation, validateAllocations } from '../src/domain/memberships.ts';

test('RN06 — alocação inteira de 1 a 100', () => {
  assert.equal(parseAllocation(' 40 '), 40);
  assert.equal(parseAllocation('100'), 100);
  for (const bad of ['', '0', '101', '12.5', '-5', 'abc']) assert.equal(parseAllocation(bad), undefined, bad);
});

test('RN06, F18 — a soma tem de ser 100; o conjunto vazio é permitido (RN21)', () => {
  assert.equal(allocationTotal([{ teamId: 'a', allocationPct: '60' }, { teamId: 'b', allocationPct: '40' }]), 100);
  assert.deepEqual(validateAllocations([{ teamId: 'a', allocationPct: '60' }, { teamId: 'b', allocationPct: '40' }]), { rows: {}, total: undefined });
  assert.ok(validateAllocations([{ teamId: 'a', allocationPct: '60' }]).total);
  assert.deepEqual(validateAllocations([]), { rows: {}, total: undefined });
});

test('F18 — equipa repetida, equipa por escolher e alocação inválida são assinaladas na linha', () => {
  const result = validateAllocations([
    { teamId: 'a', allocationPct: '50' },
    { teamId: 'a', allocationPct: '50' },
    { teamId: '', allocationPct: '10' },
    { teamId: 'c', allocationPct: '0' },
  ]);
  assert.ok(result.rows[1]?.includes('já está'));
  assert.ok(result.rows[2]?.includes('Escolha'));
  assert.ok(result.rows[3]?.includes('1 a 100'));
  assert.equal(result.rows[0], undefined);
});
