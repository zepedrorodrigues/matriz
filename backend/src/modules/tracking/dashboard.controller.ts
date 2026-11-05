import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DashboardService } from './dashboard.service';
import type { Dashboard } from './dashboard.service';

/**
 * openapi.yaml: getDashboard. Qualquer utilizador autenticado com conta ativa (o guarda global responde
 * 401/403); cada um vê só os projetos que lhe são visíveis (§3.1, CAT06).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<Dashboard> {
    return this.dashboard.forUser(user);
  }
}
