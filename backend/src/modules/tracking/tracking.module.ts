import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Módulo Acompanhamento (architecture.md §5): por agora, o painel inicial (CA07.9). Os alertas, o
 * progresso e os desvios chegam no I11. Depende da interface de leitura do módulo Organização e da
 * interface WorkItemLocator (global, disponibilizada pelo módulo Trabalho); não tem tabelas próprias
 * neste incremento.
 */
@Module({
  imports: [OrganizationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class TrackingModule {}
