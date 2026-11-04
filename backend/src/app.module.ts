import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './shared/database/database.config';
import { HealthController } from './shared/health/health.controller';

/**
 * Módulo raiz. Os módulos de domínio (identity, organization, work, planning, tracking, history —
 * DT03) entram a partir do I1, cada um em `src/modules/<módulo>`.
 */
@Module({
  imports: [
    // O .env da raiz é carregado por loadRootEnv (database.config); aqui só se expõe o ambiente.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    TypeOrmModule.forRootAsync({ useFactory: buildDataSourceOptions }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
