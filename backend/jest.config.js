/** Testes de API (DT08): Jest + supertest, contra a base de testes DB_NAME_TEST. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  // O jose 6 só é publicado em ESM; o carregador do Jest não faz require() de ESM, por isso o
  // ts-jest transpila-o para CommonJS (tsconfig.spec.json). Em execução, o Node 22+ carrega-o direto.
  transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Recria a base de testes pelas migrations antes de cada execução (implementation-plan.md §5).
  globalSetup: '<rootDir>/test/global-setup.ts',
  // Os testes partilham a mesma base; correm em série.
  maxWorkers: 1,
};
