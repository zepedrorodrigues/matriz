import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ObjectiveAccess, ProjectAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ElementInputDto } from './work.dto';
import { HierarchyService } from './hierarchy.service';
import type { Epic, Objective } from './hierarchy.service';

/** openapi.yaml: listObjectives, createObjective, createEpic. Autorização declarada em cada rota. */
@Controller()
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  @Get('projects/:projectId/objectives')
  @ProjectAccess('view')
  list(@Param('projectId') projectId: string): Promise<Objective[]> {
    return this.hierarchy.listObjectives(projectId);
  }

  @Post('projects/:projectId/objectives')
  @ProjectAccess('createWork')
  createObjective(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: ElementInputDto,
  ): Promise<Objective> {
    return this.hierarchy.createObjective(user, projectId, dto);
  }

  @Post('objectives/:objectiveId/epics')
  @ObjectiveAccess('createWork')
  createEpic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('objectiveId') objectiveId: string,
    @Body() dto: ElementInputDto,
  ): Promise<Epic> {
    return this.hierarchy.createEpic(user, objectiveId, dto);
  }
}
