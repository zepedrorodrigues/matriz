import { Controller, Get, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { OrganizationReader, UserTeam } from '../organization/organization-reader.service';
import { AccountService } from './account.service';

/** openapi.yaml: CurrentUser */
export interface CurrentUserResponse {
  id: string;
  name: string;
  workEmail: string;
  isAdmin: boolean;
  teams: UserTeam[];
  managedProjectIds: string[];
}

/** `GET /api/me` (openapi.yaml: getCurrentUser) — conta associada ao token (RN35, CA01.13). */
@Controller('me')
export class MeController {
  constructor(
    private readonly accounts: AccountService,
    private readonly organization: OrganizationReader,
  ) {}

  @Get()
  async getCurrentUser(@CurrentUser() current: AuthenticatedUser): Promise<CurrentUserResponse> {
    const user = await this.accounts.findById(current.id);
    if (!user) throw new NotFoundException();
    const [teams, managedProjectIds] = await Promise.all([
      this.organization.teamsOf(user.id),
      this.organization.managedProjectIds(user.id),
    ]);
    return { id: user.id, name: user.name, workEmail: user.workEmail, isAdmin: user.isAdmin, teams, managedProjectIds };
  }
}
