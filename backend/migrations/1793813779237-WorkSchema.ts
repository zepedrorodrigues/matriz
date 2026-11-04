import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ficha PL 03, Ex. 2 — tabelas do módulo Trabalho (database.md §2.3): hierarquia (objetivos,
 * épicos, tarefas e subtarefas), critérios de aceitação, participantes (atribuições, RN40) e
 * comentários (RN41), com as regras de integridade de §5 que se garantem na base de dados.
 *
 * Referências entre módulos são lógicas (sem chave estrangeira): project_id, team_id,
 * original_team_id, assignee_id, created_by, met_by, user_id, added_by e author_id.
 * Regras que envolvem várias linhas ou módulos (RN12 subtarefa sem subtarefas, RN22, RN23, RN26,
 * RN27, RN10, RN24) ficam na camada de domínio.
 */
export class WorkSchema1793813779237 implements MigrationInterface {
  name = 'WorkSchema1793813779237';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE work.objective (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  uuid        NOT NULL,
        title       text        NOT NULL CHECK (btrim(title) <> ''),
        description text        NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX objective_project_idx ON work.objective (project_id)`);

    await q.query(`
      CREATE TABLE work.epic (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        objective_id uuid        NOT NULL REFERENCES work.objective (id),
        title        text        NOT NULL CHECK (btrim(title) <> ''),
        description  text        NULL,
        created_at   timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX epic_objective_idx ON work.epic (objective_id)`);

    // RN17: valores técnicos dos estados; a interface apresenta-os em pt-PT.
    await q.query(`
      CREATE TYPE work.task_state AS ENUM (
        'in_planning', 'in_technical_analysis', 'ready_for_development', 'in_development',
        'in_testing', 'done', 'delivered'
      )`);
    await q.query(`CREATE TYPE work.task_priority AS ENUM ('low', 'medium', 'high')`);
    await q.query(`
      CREATE TABLE work.task (
        id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
        epic_id          uuid               NULL REFERENCES work.epic (id),
        parent_task_id   uuid               NULL REFERENCES work.task (id),
        title            varchar(150)       NOT NULL,
        description      varchar(2000)      NULL,
        team_id          uuid               NOT NULL,
        original_team_id uuid               NOT NULL,
        assignee_id      uuid               NULL,
        state            work.task_state    NOT NULL DEFAULT 'in_planning',
        estimate_hours   numeric(6,2)       NULL CHECK (estimate_hours >= 0),
        story_points     smallint           NULL CHECK (story_points IN (1, 2, 3, 5, 8, 13, 21)),
        priority         work.task_priority NOT NULL DEFAULT 'medium',
        due_date         date               NULL,
        is_blocked       boolean            NOT NULL DEFAULT false,
        block_reason     text               NULL,
        created_by       uuid               NOT NULL,
        created_at       timestamptz        NOT NULL DEFAULT now(),
        deleted_at       timestamptz        NULL,
        -- RN42: 3 a 150 caracteres depois de retirar os espaços no início e no fim.
        CONSTRAINT task_title_length_ck CHECK (char_length(btrim(title)) BETWEEN 3 AND 150),
        -- RN12, RN22: uma tarefa tem épico; uma subtarefa tem tarefa principal; nunca os dois.
        CONSTRAINT task_epic_xor_parent_ck CHECK ((epic_id IS NULL) <> (parent_task_id IS NULL)),
        -- RN28: motivo obrigatório quando bloqueada.
        CONSTRAINT task_block_reason_ck CHECK (NOT is_blocked OR coalesce(btrim(block_reason), '') <> '')
      )`);
    await q.query(`CREATE INDEX task_epic_idx ON work.task (epic_id) WHERE deleted_at IS NULL`);
    await q.query(`CREATE INDEX task_parent_idx ON work.task (parent_task_id) WHERE deleted_at IS NULL`);
    await q.query(`CREATE INDEX task_team_idx ON work.task (team_id) WHERE deleted_at IS NULL`);
    await q.query(`CREATE INDEX task_assignee_idx ON work.task (assignee_id) WHERE deleted_at IS NULL`);

    await q.query(`
      CREATE TABLE work.acceptance_criterion (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id     uuid        NOT NULL REFERENCES work.task (id),
        description text        NOT NULL CHECK (btrim(description) <> ''),
        is_met      boolean     NOT NULL DEFAULT false,
        met_by      uuid        NULL,
        met_at      timestamptz NULL,
        created_by  uuid        NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX acceptance_criterion_task_idx ON work.acceptance_criterion (task_id)`);

    // RN40: a chave composta impede participantes repetidos (CA03.14).
    await q.query(`
      CREATE TABLE work.task_participant (
        task_id  uuid        NOT NULL REFERENCES work.task (id),
        user_id  uuid        NOT NULL,
        added_by uuid        NOT NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (task_id, user_id)
      )`);
    await q.query(`CREATE INDEX task_participant_user_idx ON work.task_participant (user_id)`);

    // RN41: 1 a 2000 caracteres, não só espaços; sem edição nem remoção (regra da aplicação).
    await q.query(`
      CREATE TABLE work.comment (
        id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    uuid          NOT NULL REFERENCES work.task (id),
        author_id  uuid          NOT NULL,
        body       varchar(2000) NOT NULL CHECK (btrim(body) <> ''),
        created_at timestamptz   NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX comment_task_idx ON work.comment (task_id, created_at)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['comment', 'task_participant', 'acceptance_criterion', 'task', 'epic', 'objective']) {
      await q.query(`DROP TABLE work."${table}"`);
    }
    await q.query(`DROP TYPE work.task_priority`);
    await q.query(`DROP TYPE work.task_state`);
  }
}
