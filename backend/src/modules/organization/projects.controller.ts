import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CanCreateProject, ProjectAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ValidationFailedException } from '../../shared/errors/problem-details.filter';
import { CreateProjectDto, ListProjectsQuery, ProjectTeamInputDto, UpdateProjectDto } from './project.dto';
import { ProjectsService } from './projects.service';
import type { ProjectDetail, ProjectPage } from './projects.service';

/**
 * `/api/projects` (openapi.yaml: listProjects, createProject, getProject, updateProject,
 * deleteProject, listProjectTeams, addProjectTeam). A autorização de cada rota é declarada aqui e verificada pelo guarda global.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListProjectsQuery): Promise<ProjectPage> {
    return this.projects.list(user, query.q, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post()
  @CanCreateProject()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto): Promise<ProjectDetail> {
    return this.projects.create(user, dto);
  }

  @Get(':projectId')
  @ProjectAccess('view')
  get(@Param('projectId') projectId: string): Promise<ProjectDetail> {
    return this.projects.get(projectId);
  }

  @Patch(':projectId')
  @ProjectAccess('edit')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDetail> {
    if (dto.name === undefined && dto.objective === undefined) {
      throw new ValidationFailedException([{ field: '', message: 'Indique pelo menos o nome ou o objetivo.' }]);
    }
    return this.projects.update(user, projectId, dto);
  }

  @Get(':projectId/teams')
  @ProjectAccess('view')
  teams(@Param('projectId') projectId: string): Promise<{ id: string; name: string; active: boolean }[]> {
    return this.projects.teams(projectId);
  }

  /** §3.1: associar equipas a projetos — administrador e gestores do projeto (a mesma regra de editar). */
  @Post(':projectId/teams')
  @ProjectAccess('edit')
  addTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: ProjectTeamInputDto,
  ): Promise<{ id: string; name: string; active: boolean }[]> {
    return this.projects.addTeam(user, projectId, dto.teamId);
  }

  @Delete(':projectId')
  @ProjectAccess('delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<void> {
    await this.projects.delete(user, projectId);
  }
}
