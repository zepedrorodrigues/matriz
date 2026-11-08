import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I13, passo 1 (D50, S1): o histórico é só de acrescento também na base de dados (RN32, SEC04, CAT04).
 * Retira ao role da aplicação — o mesmo que corre as migrations (DB_USER) — o UPDATE, o DELETE e o TRUNCATE
 * sobre history.history_event; ficam o INSERT e o SELECT. O role continua dono: pode voltar a dar-se o
 * privilégio e apagar o schema (recriação da base de testes), e um superutilizador ignora o REVOKE.
 */
export class HistoryAppendOnly1794400000000 implements MigrationInterface {
  name = 'HistoryAppendOnly1794400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`REVOKE UPDATE, DELETE, TRUNCATE ON history.history_event FROM CURRENT_USER`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`GRANT UPDATE, DELETE, TRUNCATE ON history.history_event TO CURRENT_USER`);
  }
}
