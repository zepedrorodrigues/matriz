import { Global, Injectable, Module } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SPRINT_LOCATOR, type SprintLocator } from '../../shared/ports/sprint-locator';
import { OrganizationModule } from '../organization/organization.module';
import { CapacityService } from './capacity.service';
import { PlanningController } from './planning.controller';
import { SprintJobService } from './sprint-job.service';
import { SprintsService } from './sprints.service';

/** Implementação de SprintLocator pelo módulo dono das sprints (architecture.md §6). */
@Injectable()
class SprintLocatorService implements SprintLocator {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async teamOfSprint(sprintId: string): Promise<string | null> {
    const [row] = await this.db.query(`SELECT team_id FROM planning.sprint WHERE id = $1`, [sprintId]);
    return row?.team_id ?? null;
  }
}

/**
 * Módulo Planeamento (architecture.md §5): sprints e backlog de cada equipa (I9) e capacidade (I10).
 * Depende da interface de leitura do módulo Organização e das interfaces WorkItemLocator e UserDirectory
 * (globais); disponibiliza SprintLocator ao módulo Identidade e acesso.
 */
@Global()
@Module({
  imports: [OrganizationModule],
  controllers: [PlanningController],
  providers: [SprintsService, CapacityService, SprintJobService, { provide: SPRINT_LOCATOR, useClass: SprintLocatorService }],
  exports: [SPRINT_LOCATOR, SprintJobService],
})
export class PlanningModule {}
