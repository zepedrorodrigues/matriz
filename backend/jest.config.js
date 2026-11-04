/** Testes de API (DT08): Jest + supertest, contra a base de testes DB_NAME_TEST. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Recria a base de testes pelas migrations antes de cada execução (implementation-plan.md §5).
  globalSetup: '<rootDir>/test/global-setup.ts',
  // Os testes partilham a mesma base; correm em série.
  maxWorkers: 1,
};
