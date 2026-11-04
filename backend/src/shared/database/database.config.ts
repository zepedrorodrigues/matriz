import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { loadRootEnv, requireEnv } from '../config/load-env';

/**
 * Configuração única do PostgreSQL (DT02), partilhada pela aplicação, pelo CLI das migrations,
 * pelo seed e pelos testes. Com NODE_ENV=test (definido pelo Jest) usa a base de testes
 * DB_NAME_TEST, para nunca tocar nos dados de demonstração.
 */
export function databaseName(): string {
  return process.env.NODE_ENV === 'test' ? requireEnv('DB_NAME_TEST') : requireEnv('DB_NAME');
}

export function buildDataSourceOptions(): DataSourceOptions {
  loadRootEnv();
  return {
    type: 'postgres',
    host: requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: databaseName(),
    // As entidades são registadas por cada módulo a partir do I1.
    entities: [],
    migrations: [join(__dirname, '..', '..', '..', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
  };
}
