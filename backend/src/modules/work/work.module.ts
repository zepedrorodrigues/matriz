import { Global, Module } from '@nestjs/common';
import { WORK_ITEM_LOCATOR } from '../../shared/ports/work-item-locator';
import { OrganizationModule } from '../organization/organization.module';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkItemLocatorService } from './work-item-locator.service';

/**
 * Módulo Trabalho (architecture.md §5): hierarquia, tarefas e subtarefas. Depende do módulo
 * Organização (equipas do projeto). Disponibiliza a interface WorkItemLocator, de `shared/`, ao
 * módulo Identidade e acesso, que a usa para aplicar a matriz de permissões sem ler estas tabelas.
 */
@Global()
@Module({
  imports: [OrganizationModule],
  controllers: [HierarchyController, TasksController],
  providers: [HierarchyService, TasksService, { provide: WORK_ITEM_LOCATOR, useClass: WorkItemLocatorService }],
  exports: [WORK_ITEM_LOCATOR],
})
export class WorkModule {}
