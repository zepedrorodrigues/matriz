/**
 * Identificação do utilizador no cabeçalho (DT17): iniciais do avatar e papel mostrado junto ao nome.
 * Executar: npm test -w frontend.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { initials, roleSummary } from '../src/domain/people.ts';

const team = (teamName: string, role: 'leader' | 'member') => ({ teamId: teamName, teamName, role, allocationPct: 100 });

test('iniciais: primeiro e último nome, em maiúsculas, ignorando espaços a mais', () => {
  assert.equal(initials('Ana Exemplo'), 'AE');
  assert.equal(initials('  rui  da   silva exemplo '), 'RE');
  assert.equal(initials('Gonçalo'), 'G');
  assert.equal(initials('   '), '?');
});

test('papel: administrador antes de qualquer equipa', () => {
  assert.equal(roleSummary({ isAdmin: true, teams: [team('Equipa Alfa', 'leader')] }), 'Administrador');
});

test('papel: papel e equipa da primeira equipa, com +N quando há mais', () => {
  assert.equal(roleSummary({ isAdmin: false, teams: [team('Equipa Alfa', 'leader')] }), 'Líder · Equipa Alfa');
  assert.equal(roleSummary({ isAdmin: false, teams: [team('Equipa Beta', 'member'), team('Equipa Alfa', 'member')] }), 'Membro · Equipa Beta +1');
  assert.equal(roleSummary({ isAdmin: false, teams: [] }), 'Sem equipa');
});
