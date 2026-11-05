import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SYSTEM_AUTHOR_ID } from '../../shared/events/domain-events';
import { SprintsService } from './sprints.service';

/** Chave do trinco da tarefa diária no PostgreSQL (advisory lock), partilhada por todas as instâncias. */
const DAILY_JOB_LOCK = 4_271_901;
const HOUR = 60 * 60 * 1000;

/**
 * Tarefa diária (architecture.md §5, DT13): termina as sprints cuja data de fim já passou (RN36). Corre
 * ao arrancar e depois de hora a hora — a sprint termina na primeira execução depois do fim do dia —, numa
 * só instância de cada vez: antes de começar obtém um trinco no PostgreSQL e, se outra instância o tiver,
 * não faz nada. Sem dependências novas. Os prazos ultrapassados (RN30) juntam-se no I11. Desligada nos
 * testes (NODE_ENV=test), que a chamam diretamente com uma data.
 */
@Injectable()
export class SprintJobService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('TarefaDiaria');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly sprints: SprintsService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), HOUR);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Uma execução; devolve as sprints terminadas, ou `null` se outra instância tiver o trinco. */
  async runOnce(today?: string): Promise<string[] | null> {
    const runner = this.db.createQueryRunner();
    try {
      await runner.connect();
      const [{ locked }] = await runner.query(`SELECT pg_try_advisory_lock($1) AS locked`, [DAILY_JOB_LOCK]);
      if (!locked) return null;
      try {
        const closed = await this.sprints.closeEndedSprints(SYSTEM_AUTHOR_ID, today);
        if (closed.length > 0) this.logger.log(`Sprints terminadas: ${closed.length}`);
        return closed;
      } finally {
        await runner.query(`SELECT pg_advisory_unlock($1)`, [DAILY_JOB_LOCK]);
      }
    } catch (error) {
      this.logger.error(`A tarefa diária falhou: ${(error as Error).message}`);
      return [];
    } finally {
      await runner.release();
    }
  }
}
