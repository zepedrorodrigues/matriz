import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TeamPlanningAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { TeamWorkService } from './team-work.service';
import type { TeamWork, WorkGroup } from './team-work.service';

/** Filtro e paginação da vista de trabalho da equipa (D46). */
export class TeamWorkQuery {
  @IsOptional()
  @IsIn(['planned', 'in_progress', 'done', 'blocked', 'overdue'], { message: 'O grupo tem de ser planned, in_progress, done, blocked ou overdue.' })
  group?: WorkGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página tem de ser um número inteiro.' })
  @Min(1, { message: 'A página começa em 1.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O tamanho da página tem de ser um número inteiro.' })
  @Min(1, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  @Max(100, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  pageSize?: number;
}

/**
 * openapi.yaml: getTeamWork. Consultam-na quem consulta o planeamento da equipa — membros, administrador e
 * gestores dos projetos da equipa (F20) —, verificado pelo guarda global.
 */
@Controller('teams/:teamId/work')
export class TeamWorkController {
  constructor(private readonly work: TeamWorkService) {}

  @Get()
  @TeamPlanningAccess('viewPlanning')
  get(@CurrentUser() user: AuthenticatedUser, @Param('teamId') teamId: string, @Query() query: TeamWorkQuery): Promise<TeamWork> {
    return this.work.forTeam(teamId, query.group, query.page ?? 1, query.pageSize ?? 20, user);
  }
}
