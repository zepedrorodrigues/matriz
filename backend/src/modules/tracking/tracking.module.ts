import { Global, Module } from '@nestjs/common';
import { DAILY_TASK } from '../../shared/ports/daily-task';
import { OrganizationModule } from '../organization/organization.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TeamWorkController } from './team-work.controller';
import { TeamWorkService } from './team-work.service';

/**
 * Módulo Acompanhamento (architecture.md §5): painel inicial (CA07.9) e vista de trabalho da equipa
 * (CA07.1, CA07.4) e alertas (CA05.8, CA07.5, CA07.7, CA07.8, CA08.2; I11), com as tabelas `tracking`.
 * Depende da interface de leitura do módulo Organização e das interfaces WorkItemLocator, UserDirectory e
 * CapacityReader (globais); disponibiliza DailyTask (prazos) à tarefa diária do módulo Planeamento.
 */
@Global()
@Module({
  imports: [OrganizationModule],
  controllers: [DashboardController, TeamWorkController, AlertsController],
  providers: [DashboardService, TeamWorkService, AlertsService, { provide: DAILY_TASK, useExisting: AlertsService }],
  exports: [DAILY_TASK],
})
export class TrackingModule {}
