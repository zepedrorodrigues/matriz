import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TeamWorkController } from './team-work.controller';
import { TeamWorkService } from './team-work.service';

/**
 * Módulo Acompanhamento (architecture.md §5): painel inicial (CA07.9) e vista de trabalho da equipa
 * (CA07.1, CA07.4; I11). Os alertas chegam no passo 2 do I11. Depende da interface de leitura do
 * módulo Organização e das interfaces WorkItemLocator e UserDirectory (globais); ainda não tem tabelas
 * próprias.
 */
@Module({
  imports: [OrganizationModule],
  controllers: [DashboardController, TeamWorkController],
  providers: [DashboardService, TeamWorkService],
})
export class TrackingModule {}
