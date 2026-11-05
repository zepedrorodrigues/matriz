import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { SprintAccess, TeamPlanningAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ValidationFailedException } from '../../shared/errors/problem-details.filter';
import { AvailabilityInputDto, BacklogQuery, SprintDatesDto, SprintStartDto, SprintTaskInputDto } from './planning.dto';
import { CapacityService } from './capacity.service';
import type { SprintCapacity } from './capacity.service';
import { SprintsService } from './sprints.service';
import type { BacklogPage, Sprint, SprintDetail } from './sprints.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RN31: a data de início é igual ou anterior à de fim (400, como a validação dos campos). */
function requireOrder(dto: { startDate?: string; endDate?: string }) {
  if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) {
    throw new ValidationFailedException([{ field: 'endDate', message: 'A data de fim tem de ser igual ou posterior à de início (RN31).' }]);
  }
}

/**
 * openapi.yaml: listTeamSprints, createSprint, getTeamBacklog, getSprint, updateSprintDates, startSprint,
 * planSprintTask, removeSprintTask, getSprintCapacity, setAvailability, resetAvailability. A autorização é
 * declarada em cada rota e verificada pelo guarda global (§3.1, RN36).
 */
@Controller()
export class PlanningController {
  constructor(
    private readonly sprints: SprintsService,
    private readonly capacity: CapacityService,
  ) {}

  @Get('teams/:teamId/sprints')
  @TeamPlanningAccess('viewPlanning')
  list(@Param('teamId') teamId: string): Promise<Sprint[]> {
    return this.sprints.list(teamId);
  }

  @Post('teams/:teamId/sprints')
  @TeamPlanningAccess('managePlanning')
  create(@CurrentUser() user: AuthenticatedUser, @Param('teamId') teamId: string, @Body() dto: SprintDatesDto): Promise<SprintDetail> {
    requireOrder(dto);
    return this.sprints.create(user, teamId, dto.startDate, dto.endDate);
  }

  @Get('teams/:teamId/backlog')
  @TeamPlanningAccess('viewPlanning')
  backlog(@Param('teamId') teamId: string, @Query() query: BacklogQuery): Promise<BacklogPage> {
    return this.sprints.backlog(teamId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('sprints/:sprintId')
  @SprintAccess('view')
  get(@Param('sprintId') sprintId: string): Promise<SprintDetail> {
    return this.sprints.get(sprintId);
  }

  @Patch('sprints/:sprintId')
  @SprintAccess('manage')
  updateDates(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string, @Body() dto: SprintDatesDto): Promise<SprintDetail> {
    requireOrder(dto);
    return this.sprints.updateDates(user, sprintId, dto.startDate, dto.endDate);
  }

  @Post('sprints/:sprintId/start')
  @SprintAccess('start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string, @Body() dto: SprintStartDto): Promise<SprintDetail> {
    requireOrder(dto);
    return this.sprints.start(user, sprintId, dto ?? {});
  }

  @Post('sprints/:sprintId/tasks')
  @SprintAccess('manage')
  plan(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string, @Body() dto: SprintTaskInputDto): Promise<SprintDetail> {
    return this.sprints.planTask(user, sprintId, dto.taskId);
  }

  @Get('sprints/:sprintId/capacity')
  @SprintAccess('view')
  sprintCapacity(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string): Promise<SprintCapacity> {
    return this.capacity.forSprint(user, sprintId);
  }

  /** §3.1: ajustar a disponibilidade — só o líder da equipa (CA05.5). */
  @Put('sprints/:sprintId/availability/:userId')
  @SprintAccess('manage')
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId') sprintId: string,
    @Param('userId') userId: string,
    @Body() dto: AvailabilityInputDto,
  ): Promise<SprintCapacity> {
    if (!UUID.test(userId)) throw new NotFoundException('O utilizador não existe.');
    return this.capacity.setAvailability(user, sprintId, userId, dto.availableHours);
  }

  @Delete('sprints/:sprintId/availability/:userId')
  @SprintAccess('manage')
  @HttpCode(200)
  resetAvailability(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string, @Param('userId') userId: string): Promise<SprintCapacity> {
    if (!UUID.test(userId)) throw new NotFoundException('Este membro não tem horas ajustadas nesta sprint.');
    return this.capacity.resetAvailability(user, sprintId, userId);
  }

  @Delete('sprints/:sprintId/tasks/:taskId')
  @SprintAccess('manage')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('sprintId') sprintId: string, @Param('taskId') taskId: string): Promise<SprintDetail> {
    if (!UUID.test(taskId)) throw new NotFoundException('A tarefa não está nesta sprint.');
    return this.sprints.removeTask(user, sprintId, taskId);
  }
}
