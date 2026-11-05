import { Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { AdminOnly } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { CreateTeamDto, MembershipsInputDto, UpdateTeamDto } from './teams.dto';
import { TeamsService } from './teams.service';
import type { TeamDetail, TeamSummary, UserMemberships } from './teams.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identificador mal formado: o mesmo que um elemento inexistente (404), sem chegar à base. */
const requireUuid = (id: string, message: string) => {
  if (!UUID.test(id)) throw new NotFoundException(message);
};

/**
 * openapi.yaml: listTeams, createTeam, getTeam, updateTeam, deactivateTeam, getUserMemberships,
 * replaceUserMemberships. Só o administrador gere equipas e pertenças (§3.1); a listagem de equipas é
 * para qualquer utilizador autenticado (o gestor associa equipas aos seus projetos).
 */
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('teams')
  list(@CurrentUser() user: AuthenticatedUser): Promise<TeamSummary[]> {
    return this.teams.list(user);
  }

  @Post('teams')
  @AdminOnly()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto): Promise<TeamDetail> {
    return this.teams.create(user, dto);
  }

  @Get('teams/:teamId')
  @AdminOnly()
  get(@Param('teamId') teamId: string): Promise<TeamDetail> {
    requireUuid(teamId, 'A equipa não existe.');
    return this.teams.get(teamId);
  }

  @Patch('teams/:teamId')
  @AdminOnly()
  rename(@CurrentUser() user: AuthenticatedUser, @Param('teamId') teamId: string, @Body() dto: UpdateTeamDto): Promise<TeamDetail> {
    requireUuid(teamId, 'A equipa não existe.');
    return this.teams.rename(user, teamId, dto.name);
  }

  @Post('teams/:teamId/deactivate')
  @AdminOnly()
  @HttpCode(200)
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('teamId') teamId: string): Promise<TeamDetail> {
    requireUuid(teamId, 'A equipa não existe.');
    return this.teams.deactivate(user, teamId);
  }

  @Get('users/:userId/memberships')
  @AdminOnly()
  memberships(@Param('userId') userId: string): Promise<UserMemberships> {
    requireUuid(userId, 'O utilizador não existe.');
    return this.teams.membershipsOf(userId);
  }

  @Put('users/:userId/memberships')
  @AdminOnly()
  replaceMemberships(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: MembershipsInputDto,
  ): Promise<UserMemberships> {
    requireUuid(userId, 'O utilizador não existe.');
    return this.teams.replaceMemberships(user, userId, dto.memberships);
  }
}
