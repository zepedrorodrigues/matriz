/**
 * Regras das contas repetidas na interface (CA01.13). A API aplica as mesmas regras
 * (backend/test/accounts.e2e-spec.ts). Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { accountStatus, validateAccount } from '../src/domain/accounts.ts';

test('CA01.13 — nome vazio, só com espaços ou com mais de 100 caracteres e e-mail inválido são recusados', () => {
  for (const name of ['', '   ', 'n'.repeat(101)]) assert.ok(validateAccount({ name, workEmail: 'a@matriz.example' }).name);
  for (const workEmail of ['', 'sem-arroba', 'a@', 'a b@matriz.example']) assert.ok(validateAccount({ name: 'Nome', workEmail }).workEmail);
  assert.deepEqual(validateAccount({ name: ` ${'n'.repeat(100)} `, workEmail: ' nova@matriz.example ' }), {});
});

test('RN35 — o estado mostra se a conta já foi ligada no primeiro acesso', () => {
  assert.equal(accountStatus({ active: true, linked: false }), 'Por ligar (ainda não acedeu)');
  assert.equal(accountStatus({ active: true, linked: true }), 'Ligada');
  assert.equal(accountStatus({ active: false, linked: true }), 'Desativada');
});
