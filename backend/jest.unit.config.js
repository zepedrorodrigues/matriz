/**
 * Testes unitários (Ficha PL 04, Ex. 2): os ficheiros `src/**\/*.spec.ts`, sem base de dados nem servidor —
 * por isso sem o globalSetup que recria a base de testes. `npm test` corre-os também, com os de API.
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  testRegex: 'src/.*\\.spec\\.ts$',
  globalSetup: undefined,
};
