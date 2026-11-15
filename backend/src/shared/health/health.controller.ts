import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/auth.decorators';
import { IdentityProviderProbe } from './identity-provider.probe';

/** O que o controlador usa da resposta HTTP (evita depender dos tipos do Express). */
interface StatusSettable {
  status(code: number): unknown;
}

type Availability = 'ok' | 'unavailable';

export interface Health {
  status: Availability;
  database: Availability;
}

export interface Liveness {
  status: 'ok';
}

export interface Readiness {
  status: Availability;
  database: Availability;
  identityProvider: Availability;
}

/**
 * Verificações de saúde (openapi.yaml: getHealth, getLiveness, getReadiness; DT13, DT20) — sem
 * autenticação; não devolvem dados de utilizadores.
 *
 * - `GET /api/health`: o processo responde e chega à base de dados. É a que o Docker e o compose usam.
 * - `GET /api/health/live`: o processo responde, sem tocar em mais nada (reiniciar ou não).
 * - `GET /api/health/ready`: a base de dados e o fornecedor de identidade respondem (receber pedidos ou não).
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identityProvider: IdentityProviderProbe,
  ) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: StatusSettable): Promise<Health> {
    const database = await this.database();
    if (database !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: database, database };
  }

  @Get('live')
  getLiveness(): Liveness {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) res: StatusSettable): Promise<Readiness> {
    const [database, identityProvider] = await Promise.all([
      this.database(),
      this.identityProvider.isAvailable().then((ok): Availability => (ok ? 'ok' : 'unavailable')),
    ]);
    const status: Availability = database === 'ok' && identityProvider === 'ok' ? 'ok' : 'unavailable';
    if (status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, database, identityProvider };
  }

  private async database(): Promise<Availability> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }
}
