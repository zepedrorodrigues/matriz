/**
 * Transferências na interface (RN20, RN22, RN23, RN33; decisões 1a e 2a, F22). A API aplica as regras
 * (backend/test/transfers.e2e-spec.ts). Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { transferConsequences, transferTargets } from '../src/domain/tasks.ts';

test('RN23, RN33 — destinos: as equipas ativas do projeto, menos a atual', () => {
  const teams = [
    { id: 'a', name: 'Alfa', active: true },
    { id: 'b', name: 'Beta', active: true },
    { id: 'c', name: 'Gama', active: false },
  ];
  assert.deepEqual(transferTargets(teams, 'a').map((t) => t.id), ['b']);
  assert.deepEqual(transferTargets(teams, 'x').map((t) => t.id), ['a', 'b']);
});

test('RN22, RN20, RN15 — consequências mostradas antes de confirmar', () => {
  const none = transferConsequences({ subtaskCount: 0, targetName: 'Beta', hasAssignee: false });
  assert.equal(none.length, 2);
  assert.match(none[0], /^A tarefa passa para «Beta»/);
  assert.match(transferConsequences({ subtaskCount: 1, targetName: 'Beta', hasAssignee: false })[0], /A tarefa e a subtarefa passam/);
  assert.match(transferConsequences({ subtaskCount: 3, targetName: 'Beta', hasAssignee: false })[0], /as 3 subtarefas passam/);
  const withAssignee = transferConsequences({ subtaskCount: 0, targetName: 'Beta', hasAssignee: true });
  assert.equal(withAssignee.at(-1), 'Se o responsável não for membro de «Beta», deixa de o ser.');
});
