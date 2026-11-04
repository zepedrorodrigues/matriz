import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/shared/database/database.config';
import { requireEnv } from '../src/shared/config/load-env';

const MODULE_SCHEMAS = ['identity', 'organization', 'work', 'planning', 'tracking', 'history'];

/**
 * Recria a base de testes antes de cada execução: apaga os schemas dos módulos e a tabela das
 * migrations e volta a correr as migrations. Só atua na base DB_NAME_TEST e recusa-se a correr
 * se ela coincidir com a base de demonstração.
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  const options = buildDataSourceOptions();
  const testDb = requireEnv('DB_NAME_TEST');
  if (options.database !== testDb || testDb === process.env.DB_NAME) {
    throw new Error('Os testes só podem recriar a base DB_NAME_TEST, distinta de DB_NAME.');
  }

  const dataSource = new DataSource(options);
  await dataSource.initialize();
  try {
    for (const schema of MODULE_SCHEMAS) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await dataSource.query('DROP TABLE IF EXISTS public.migrations');
    await dataSource.runMigrations({ transaction: 'all' });
  } finally {
    await dataSource.destroy();
  }
}
