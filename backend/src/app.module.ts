import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryModule } from './modules/history/history.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { buildDataSourceOptions } from './shared/database/database.config';
import { ProblemDetailsFilter } from './shared/errors/problem-details.filter';
import { apiValidationPipe } from './shared/errors/validation.pipe';
import { HealthController } from './shared/health/health.controller';
import { SharedModule } from './shared/shared.module';

/**
 * Módulo raiz. Módulos de domínio em `src/modules/<módulo>` (DT03); os restantes (work, planning,
 * tracking, history) entram nos incrementos respetivos.
 */
@Module({
  imports: [
    // O .env da raiz é carregado por loadRootEnv (database.config); aqui só se expõe o ambiente.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...buildDataSourceOptions(), autoLoadEntities: true }) }),
    SharedModule,
    HistoryModule,
    OrganizationModule,
    IdentityModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useFactory: apiValidationPipe },
  ],
})
export class AppModule {}
