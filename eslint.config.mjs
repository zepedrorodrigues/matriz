// Análise estática (Ficha PL 04, Ex. 5.3; DT18): regras recomendadas do ESLint e do typescript-eslint,
// mais as duas regras com tipos que apanham promessas esquecidas. Executar: npm run lint.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'e2e/test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `const { a: _a, ...resto } = x` é a forma de retirar um campo: o `_` assinala que não se usa.
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Código com tsconfig próprio: regras que precisam dos tipos.
    files: ['backend/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'frontend/vite.config.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          // O `navigate` do react-router devolve `void | Promise<void>` e nunca rejeita: não há erro a perder.
          allowForKnownSafeCalls: [{ from: 'package', name: 'NavigateFunction', package: 'react-router' }],
        },
      ],
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // Configurações do Jest em CommonJS (o backend não é `type: module`).
    files: ['backend/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Scripts executados diretamente pelo Node.
    files: ['scripts/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', fetch: 'readonly', process: 'readonly', URL: 'readonly', URLSearchParams: 'readonly' },
    },
  },
  {
    // Servido tal e qual ao browser.
    files: ['frontend/public/*.js'],
    languageOptions: { globals: { window: 'readonly' } },
  },
);
