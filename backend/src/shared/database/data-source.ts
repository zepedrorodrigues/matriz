import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

/** Exportação usada apenas pelo CLI do TypeORM (`npm run typeorm`). */
export default new DataSource(buildDataSourceOptions());
