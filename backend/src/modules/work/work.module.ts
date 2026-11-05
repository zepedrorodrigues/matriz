import { Global, Module } from '@nestjs/common';
import { WORK_ITEM_LOCATOR } from '../../shared/ports/work-item-locator';
import { OrganizationModule } from '../organization/organization.module';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CriteriaController } from './criteria.controller';
import { CriteriaService } from './criteria.service';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkItemLocatorService } from './work-item-locator.service';

/**
 * Módulo Trabalho (architecture.md §5): hierarquia, tarefas e subtarefas, critérios de aceitação,
 * responsável, participantes e comentários. Depende do módulo Organização (equipas do projeto).
 * Disponibiliza a interface WorkItemLocator, de `shared/`, ao módulo Identidade e acesso, que a usa
 * para aplicar a matriz de permissões sem ler estas tabelas.
 */
@Global()
@Module({
  imports: [OrganizationModule],
  controllers: [HierarchyController, TasksController, CriteriaController, ParticipantsController, CommentsController],
  providers: [
    HierarchyService,
    TasksService,
    CriteriaService,
    ParticipantsService,
    CommentsService,
    { provide: WORK_ITEM_LOCATOR, useClass: WorkItemLocatorService },
  ],
  exports: [WORK_ITEM_LOCATOR],
})
export class WorkModule {}
