import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/auth.decorators';

/** O que o controlador usa da resposta HTTP (evita depender dos tipos do Express). */
interface StatusSettable {
  status(code: number): unknown;
}

export interface Health {
  status: 'ok' | 'unavailable';
  database: 'ok' | 'unavailable';
}

/** `GET /api/health` (openapi.yaml: getHealth) — sem autenticação; não devolve dados de utilizadores. */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: StatusSettable): Promise<Health> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'unavailable', database: 'unavailable' };
    }
  }
}
