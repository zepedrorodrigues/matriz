import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Testes End-to-End (Ficha PL 04, Ex. 4) com Playwright, no Chrome já instalado (`channel: 'chrome'`):
 * não se descarregam browsers. Pré-requisitos: o Keycloak, a API e o frontend a correr (README ›
 * Desenvolvimento). A palavra-passe das contas fictícias vem de MATRIZ_DEMO_PASSWORD, no `.env` local
 * (nunca no repositório, SEC08). Executar: npm run test:e2e.
 */
try {
  process.loadEnvFile(resolve(__dirname, '..', '.env'));
} catch {
  // Sem .env: as variáveis têm de vir do ambiente (p. ex. num pipeline de CI).
}

export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    locale: 'pt-PT',
    // Só para diagnosticar falhas: trace e captura de ecrã ficam apenas quando o teste falha.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
