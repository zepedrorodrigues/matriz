import { expect, test } from '@playwright/test';
import { requireEnvironment, signIn } from './support';

/**
 * Ficha PL 04, Ex. 4 — percurso do utilizador pela interface: autenticar → abrir projeto → criar tarefa →
 * verificar a tarefa na listagem (CA03.1, CA03.11, CA03.19; docs/test-plan.md, cenário E2E-01).
 *
 * - Utilizador: `ana` (líder da Equipa Alfa no seed), no projeto «Portal Interno».
 * - Dados isolados: o título leva a data e hora da execução, por isso o teste não depende de execuções
 *   anteriores; no fim, a tarefa é eliminada pela interface (eliminação lógica, RN38), para o projeto voltar
 *   ao estado inicial nas listagens.
 * - Seletores pelo papel e pelo nome acessível (rótulos, botões, ligações) — os que o utilizador vê —, sem
 *   classes CSS nem esperas fixas: as asserções do Playwright esperam até a condição se verificar.
 */
const USER = process.env.E2E_USER ?? 'ana';
const PROJECT = process.env.E2E_PROJECT ?? 'Portal Interno';
const TEAM = process.env.E2E_TEAM ?? 'Equipa Alfa';

test.beforeAll(async ({ request }) => {
  await requireEnvironment(request);
});

test('E2E-01 — autenticar, abrir o projeto, criar uma tarefa e encontrá-la na listagem', async ({ page }) => {
  const title = `Tarefa E2E ${new Date().toISOString().replace(/[:.]/g, '-')}`;

  await signIn(page, USER);

  // Abrir o projeto a partir da navegação principal.
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Projetos' }).click();
  await page.getByRole('link', { name: PROJECT, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: PROJECT })).toBeVisible();

  // Criar a tarefa.
  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Equipa responsável').selectOption({ label: TEAM });
  await page.getByRole('button', { name: 'Criar tarefa' }).click();

  // A interface confirma com a resposta da API e mostra a tarefa na listagem, sem recarregar (Ex. 7).
  await expect(page.getByText(`Tarefa «${title}» criada.`)).toBeVisible();
  const link = page.getByRole('link', { name: title, exact: true });
  await expect(link).toBeVisible();

  // E continua lá depois de recarregar a página (persistência na base, não só no estado da interface).
  await page.reload();
  await expect(link).toBeVisible();

  // Limpeza: eliminar pela interface, com confirmação, e confirmar que sai da listagem.
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar tarefa' }).click();
  await expect(page.getByText('Tarefa eliminada.')).toBeVisible();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
});
