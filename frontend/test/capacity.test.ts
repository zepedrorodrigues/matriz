/**
 * Apresentação da capacidade (RN06, RN19, CA05.5). A API faz os cálculos (backend/test/capacity.e2e-spec.ts).
 * Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hoursText, parseAvailability, remainingText } from '../src/domain/capacity.ts';

test('RN19 — o que resta ou quanto excede, sem impedir', () => {
  assert.equal(remainingText(10), 'restam 10 h');
  assert.equal(remainingText(-12), 'excede em 12 h');
  assert.equal(remainingText(0), 'sem horas de folga');
  assert.equal(hoursText(32.5), '32,5 h');
});

test('CA05.5 — horas disponíveis de 0 a 9999,99 com vírgula ou ponto', () => {
  assert.equal(parseAvailability('32,5'), 32.5);
  assert.equal(parseAvailability('0'), 0);
  for (const bad of ['', '-1', '10000', '1,234', 'oito']) assert.equal(parseAvailability(bad), undefined, bad);
});
