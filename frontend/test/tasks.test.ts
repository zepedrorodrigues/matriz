/**
 * Regras das tarefas repetidas na interface (Ficha PL 03, Ex. 5): estados que a interface oferece
 * (RN26) e validação do título e da descrição antes do pedido (RN42, CA03.18). A API aplica as
 * mesmas regras (backend/test/tasks.e2e-spec.ts).
 *
 * Executar: npm test -w frontend (node:test do Node, sem dependências novas).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { lifecycleTargets, validateTaskText } from '../src/domain/tasks.ts';

test('RN26 — oferece o estado seguinte e os anteriores, do mais próximo para o mais distante', () => {
  assert.deepEqual(lifecycleTargets('in_planning'), ['in_technical_analysis']);
  assert.deepEqual(lifecycleTargets('in_development'), [
    'in_testing',
    'ready_for_development',
    'in_technical_analysis',
    'in_planning',
  ]);
  assert.deepEqual(lifecycleTargets('done'), [
    'delivered',
    'in_testing',
    'in_development',
    'ready_for_development',
    'in_technical_analysis',
    'in_planning',
  ]);
});

test('RN26 — de «Entregue» só se sai por reabertura, para «A desenvolver»', () => {
  assert.deepEqual(lifecycleTargets('delivered'), ['in_development']);
});

test('CA03.18 — título vazio, só com espaços, curto ou longo e descrição longa são recusados', () => {
  for (const title of ['', '     ', '  ab  ', 'x'.repeat(151)]) {
    assert.ok(validateTaskText({ title, description: '' }).title, `título «${title.slice(0, 10)}» devia ser recusado`);
  }
  assert.ok(validateTaskText({ title: 'Válido', description: 'd'.repeat(2001) }).description);
  assert.deepEqual(validateTaskText({ title: '  abc  ', description: 'd'.repeat(2000) }), {});
  assert.deepEqual(validateTaskText({ title: 'y'.repeat(150), description: '' }), {});
});
