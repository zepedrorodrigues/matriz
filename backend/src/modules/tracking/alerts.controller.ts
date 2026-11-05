import { Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { AlertsService } from './alerts.service';
import type { Alert, AlertPage } from './alerts.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AlertsQuery {
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

/** openapi.yaml: listAlerts, markAlertRead — cada utilizador autenticado, só os seus alertas (SEC07). */
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: AlertsQuery): Promise<AlertPage> {
    return this.alerts.list(user, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post(':alertId/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthenticatedUser, @Param('alertId') alertId: string): Promise<Alert> {
    if (!UUID.test(alertId)) throw new NotFoundException('O alerta não existe.');
    return this.alerts.markRead(user, alertId);
  }
}
