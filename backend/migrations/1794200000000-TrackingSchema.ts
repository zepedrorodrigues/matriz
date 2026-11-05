import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I11, passo 2 — alertas na aplicação (database.md §2.5; RN18, RN19, RN30; DT07). Referências lógicas (sem
 * chave estrangeira) a utilizadores, tarefas, equipas e sprints de outros módulos.
 *
 * - `alert.due_date`: o prazo que gerou um alerta `deadline_passed`; com o índice único, há um alerta por
 *   tarefa, destinatário e prazo (decisão do humano, F21).
 * - `alert.user_id`: a pessoa sobrecarregada num alerta `individual_overload`, que também chega aos líderes.
 * - `overload_flag`: quem está assinalado em sobrecarga numa sprint (a equipa ou um membro), para alertar
 *   só na passagem a sobrecarga e não repetir enquanto durar (F21).
 */
export class TrackingSchema1794200000000 implements MigrationInterface {
  name = 'TrackingSchema1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TYPE tracking.alert_type AS ENUM (
        'deadline_passed', 'task_blocked', 'task_reopened', 'member_task_created', 'team_overload', 'individual_overload'
      )`);
    await q.query(`
      CREATE TABLE tracking.alert (
        id           uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id uuid                NOT NULL,
        type         tracking.alert_type NOT NULL,
        task_id      uuid                NULL,
        team_id      uuid                NULL,
        sprint_id    uuid                NULL,
        user_id      uuid                NULL,
        due_date     date                NULL,
        created_at   timestamptz         NOT NULL DEFAULT now(),
        read_at      timestamptz         NULL,
        CONSTRAINT alert_deadline_ck CHECK ((type = 'deadline_passed') = (due_date IS NOT NULL)),
        CONSTRAINT alert_member_ck CHECK ((type = 'individual_overload') = (user_id IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX alert_recipient_idx ON tracking.alert (recipient_id, created_at DESC)`);
    await q.query(
      `CREATE UNIQUE INDEX alert_deadline_once_uk ON tracking.alert (task_id, recipient_id, due_date) WHERE type = 'deadline_passed'`,
    );
    await q.query(`
      CREATE TABLE tracking.overload_flag (
        sprint_id  uuid        NOT NULL,
        subject_id uuid        NOT NULL,
        flagged_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (sprint_id, subject_id)
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE tracking.overload_flag`);
    await q.query(`DROP TABLE tracking.alert`);
    await q.query(`DROP TYPE tracking.alert_type`);
  }
}
