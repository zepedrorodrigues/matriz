import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { EpicAccess, ObjectiveAccess, ProjectAccess, SprintAccess, TaskAccess, TeamPlanningAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { HistoryReader } from './history.reader';
import type { HistoryPage } from './history.reader';

/** Paginação do histórico, como a dos comentários (D46). */
export class HistoryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página tem de ser um número inteiro.' })
  @Min(1, { message: 'A página começa em 1.' })
  @Max(100000, { message: 'A página tem de estar entre 1 e 100000.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O tamanho da página tem de ser um número inteiro.' })
  @Min(1, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  @Max(100, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  pageSize?: number;
}

/**
 * openapi.yaml: list{Project,Objective,Epic,Task,Sprint,Team}History (D50). Só leitura (SEC04). Quem consulta
 * é verificado pelo guarda global (§3.1): a equipa e a sprint com as regras do planeamento; o resto com as do
 * projeto ou da tarefa, e os eliminados só para o administrador.
 */
@Controller()
export class HistoryController {
  constructor(private readonly history: HistoryReader) {}

  @Get('projects/:projectId/history')
  @ProjectAccess('viewHistory')
  project(@Param('projectId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('project', id, q.page ?? 1, q.pageSize ?? 20, user);
  }

  @Get('objectives/:objectiveId/history')
  @ObjectiveAccess('viewHistory')
  objective(@Param('objectiveId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('objective', id, q.page ?? 1, q.pageSize ?? 20, user);
  }

  @Get('epics/:epicId/history')
  @EpicAccess('viewHistory')
  epic(@Param('epicId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('epic', id, q.page ?? 1, q.pageSize ?? 20, user);
  }

  @Get('tasks/:taskId/history')
  @TaskAccess('viewHistory')
  task(@Param('taskId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('task', id, q.page ?? 1, q.pageSize ?? 20, user);
  }

  @Get('sprints/:sprintId/history')
  @SprintAccess('view')
  sprint(@Param('sprintId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('sprint', id, q.page ?? 1, q.pageSize ?? 20, user);
  }

  @Get('teams/:teamId/history')
  @TeamPlanningAccess('viewPlanning')
  team(@Param('teamId') id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthenticatedUser): Promise<HistoryPage> {
    return this.history.list('team', id, q.page ?? 1, q.pageSize ?? 20, user);
  }
}
