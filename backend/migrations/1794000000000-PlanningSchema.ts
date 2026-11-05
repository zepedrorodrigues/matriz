import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I9 — tabelas do módulo Planeamento (database.md §2.4): sprints de cada equipa e planeamento das
 * tarefas nelas (RN01, RN04, RN05, RN10, RN27, RN31, RN36, RN37). A tabela availability_adjustment
 * (capacidade, CA05.5) entra no I10.
 *
 * Referências entre módulos são lógicas (sem chave estrangeira): team_id e task_id. Garante-se aqui:
 * início ≤ fim (RN31) e no máximo uma sprint ativa por equipa (RN31). A não sobreposição das sprints de
 * uma equipa e «cada tarefa no máximo numa sprint em aberto» envolvem várias linhas e ficam na camada
 * de domínio, serializadas por um trinco por equipa (database.md §5).
 */
export class PlanningSchema1794000000000 implements MigrationInterface {
  name = 'PlanningSchema1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE planning.sprint_status AS ENUM ('planned', 'active', 'closed')`);
    await q.query(`
      CREATE TABLE planning.sprint (
        id         uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id    uuid                   NOT NULL,
        start_date date                   NOT NULL,
        end_date   date                   NOT NULL,
        status     planning.sprint_status NOT NULL DEFAULT 'planned',
        started_at timestamptz            NULL,
        closed_at  timestamptz            NULL,
        created_at timestamptz            NOT NULL DEFAULT now(),
        CONSTRAINT sprint_dates_ck CHECK (start_date <= end_date),
        CONSTRAINT sprint_started_ck CHECK ((status = 'planned') = (started_at IS NULL)),
        CONSTRAINT sprint_closed_ck CHECK ((status = 'closed') = (closed_at IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX sprint_team_idx ON planning.sprint (team_id, start_date)`);
    // RN31: cada equipa tem, no máximo, uma sprint ativa.
    await q.query(`CREATE UNIQUE INDEX sprint_one_active_uk ON planning.sprint (team_id) WHERE status = 'active'`);

    await q.query(`CREATE TYPE planning.sprint_task_left_reason AS ENUM ('sprint_ended', 'removed', 'transferred')`);
    await q.query(`
      CREATE TABLE planning.sprint_task (
        sprint_id            uuid                              NOT NULL REFERENCES planning.sprint (id),
        task_id              uuid                              NOT NULL,
        planned_at           timestamptz                       NOT NULL DEFAULT now(),
        added_after_start    boolean                           NOT NULL DEFAULT false,
        start_estimate_hours numeric(6,2)                      NULL CHECK (start_estimate_hours >= 0),
        start_story_points   smallint                          NULL,
        left_at              timestamptz                       NULL,
        left_reason          planning.sprint_task_left_reason  NULL,
        PRIMARY KEY (sprint_id, task_id),
        CONSTRAINT sprint_task_left_ck CHECK ((left_at IS NULL) = (left_reason IS NULL))
      )`);
    await q.query(`CREATE INDEX sprint_task_task_idx ON planning.sprint_task (task_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE planning.sprint_task`);
    await q.query(`DROP TYPE planning.sprint_task_left_reason`);
    await q.query(`DROP TABLE planning.sprint`);
    await q.query(`DROP TYPE planning.sprint_status`);
  }
}
