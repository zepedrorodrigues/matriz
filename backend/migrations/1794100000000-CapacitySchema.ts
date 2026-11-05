import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I10 — ajustes de disponibilidade (database.md §2.4; CA05.5, RN06, SEC06): as horas disponíveis de um
 * membro numa sprint, quando diferentes do cálculo de RN06. Sem coluna de motivo (SEC06). A capacidade
 * não é guardada: calcula-se a partir das datas da sprint, da alocação e destes ajustes.
 * user_id e updated_by são referências lógicas (sem chave estrangeira) ao módulo Identidade.
 */
export class CapacitySchema1794100000000 implements MigrationInterface {
  name = 'CapacitySchema1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE planning.availability_adjustment (
        sprint_id       uuid         NOT NULL REFERENCES planning.sprint (id),
        user_id         uuid         NOT NULL,
        available_hours numeric(6,2) NOT NULL CHECK (available_hours >= 0),
        updated_by      uuid         NOT NULL,
        updated_at      timestamptz  NOT NULL DEFAULT now(),
        PRIMARY KEY (sprint_id, user_id)
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE planning.availability_adjustment`);
  }
}
