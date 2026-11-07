/**
 * Regras do quadro da sprint (DT17): arrastar e «Mover para…» seguem RN26, RN27, RN36 e RN37.
 * Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BACKLOG, moveOptions, resolveDrop } from '../src/domain/board.ts';
import { lifecycleTargets, MEMBER_STATES } from '../src/domain/tasks.ts';

const leader = { mayPlan: true };
const member = { mayPlan: false };

test('RN36 — do backlog para a sprint: o líder planeia; o membro é recusado', () => {
  const base = { from: BACKLOG, to: 'in_development' as const, state: 'in_planning' as const, targets: lifecycleTargets('in_planning') };
  assert.deepEqual(resolveDrop({ ...base, ...leader }), { kind: 'plan' });
  const refused = resolveDrop({ ...base, ...member });
  assert.equal(refused.kind, 'refuse');
});

test('RN27 — tarefa sem estimativa temporal não entra na sprint, com o motivo', () => {
  const reason = 'Precisa de estimativa temporal para ser planeada (RN27).';
  const move = resolveDrop({ from: BACKLOG, to: 'in_planning', state: 'in_planning', targets: [], mayPlan: true, notPlannableReason: reason });
  assert.deepEqual(move, { kind: 'refuse', reason });
  assert.deepEqual(moveOptions({ from: BACKLOG, state: 'in_planning', targets: [], mayPlan: true, notPlannableReason: reason }), []);
});

test('RN37 — devolver ao backlog: só o líder', () => {
  const base = { from: 'in_testing' as const, to: BACKLOG, state: 'in_testing' as const, targets: lifecycleTargets('in_testing') };
  assert.deepEqual(resolveDrop({ ...base, ...leader }), { kind: 'remove' });
  assert.equal(resolveDrop({ ...base, ...member }).kind, 'refuse');
});

test('RN26 — avança-se um estado de cada vez e recua-se para qualquer anterior', () => {
  const targets = lifecycleTargets('ready_for_development');
  const at = { from: 'ready_for_development' as const, state: 'ready_for_development' as const, targets, mayPlan: true };
  assert.deepEqual(resolveDrop({ ...at, to: 'in_development' }), { kind: 'state', to: 'in_development' });
  assert.deepEqual(resolveDrop({ ...at, to: 'in_planning' }), { kind: 'state', to: 'in_planning' });
  const skip = resolveDrop({ ...at, to: 'in_testing' });
  assert.deepEqual(skip, { kind: 'refuse', reason: 'Avança-se um estado de cada vez: o seguinte é «A desenvolver».' });
});

test('RN26 — «Entregue» só reabre para «A desenvolver»', () => {
  const at = { from: 'delivered' as const, state: 'delivered' as const, targets: lifecycleTargets('delivered'), mayPlan: true };
  assert.deepEqual(resolveDrop({ ...at, to: 'in_development' }), { kind: 'state', to: 'in_development' });
  assert.deepEqual(resolveDrop({ ...at, to: 'in_testing' }), { kind: 'refuse', reason: 'Uma tarefa «Entregue» só pode ser reaberta para «A desenvolver».' });
});

test('RN26 — o membro só move entre «Pronto a desenvolver» e «Terminada» as tarefas que lhe estão atribuídas', () => {
  const targets = lifecycleTargets('in_development').filter((s) => MEMBER_STATES.includes(s));
  const at = { from: 'in_development' as const, state: 'in_development' as const, targets, mayPlan: false };
  assert.deepEqual(resolveDrop({ ...at, to: 'in_testing' }), { kind: 'state', to: 'in_testing' });
  assert.equal(resolveDrop({ ...at, to: 'in_planning' }).kind, 'refuse');
  const none = resolveDrop({ ...at, targets: [], to: 'in_testing' });
  assert.equal(none.kind, 'refuse');
  assert.match((none as { reason: string }).reason, /só o responsável/);
});

test('largar na própria coluna não faz nada', () => {
  assert.deepEqual(resolveDrop({ from: 'in_testing', to: 'in_testing', state: 'in_testing', targets: [], mayPlan: true }), { kind: 'none' });
});

test('«Mover para…» oferece exatamente os destinos que o arrasto aceita', () => {
  const ctx = { from: 'in_testing' as const, state: 'in_testing' as const, targets: lifecycleTargets('in_testing'), mayPlan: true };
  const options = moveOptions(ctx);
  assert.deepEqual(options.map((o) => o.to), ['done', 'in_development', 'ready_for_development', 'in_technical_analysis', 'in_planning', BACKLOG]);
  for (const o of options) assert.notEqual(resolveDrop({ ...ctx, to: o.to }).kind, 'refuse');
  assert.deepEqual(moveOptions({ ...ctx, mayPlan: false }).map((o) => o.to).includes(BACKLOG), false);
});
