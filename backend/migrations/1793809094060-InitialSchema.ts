import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I0 — schemas por módulo (DT03, database.md §1) e tabelas de identidade, organização e histórico
 * (database.md §2.1, §2.2, §2.6), com as regras de integridade de §5 que lhes dizem respeito.
 *
 * Referências entre módulos são lógicas (sem chave estrangeira): team_membership.user_id,
 * project_manager.user_id, history_event.entity_id e history_event.author_id.
 * As permissões só de inserção e leitura do histórico (SEC04) aplicam-se no I13.
 */
export class InitialSchema1793809094060 implements MigrationInterface {
  name = 'InitialSchema1793809094060';

  public async up(q: QueryRunner): Promise<void> {
    for (const schema of ['identity', 'organization', 'work', 'planning', 'tracking', 'history']) {
      await q.query(`CREATE SCHEMA "${schema}"`);
    }

    // identity.user (database.md §2.1)
    await q.query(`
      CREATE TABLE identity."user" (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        external_subject text        NULL,
        name             text        NOT NULL CHECK (btrim(name) <> ''),
        work_email       text        NOT NULL CHECK (btrim(work_email) <> ''),
        is_admin         boolean     NOT NULL DEFAULT false,
        active           boolean     NOT NULL DEFAULT true,
        deactivated_at   timestamptz NULL,
        created_at       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_external_subject_uk UNIQUE (external_subject)
      )`);
    // O e-mail liga a conta à identidade do fornecedor (RN35); único sem distinguir maiúsculas.
    await q.query(`CREATE UNIQUE INDEX user_work_email_uk ON identity."user" (lower(work_email))`);

    // organization (database.md §2.2)
    await q.query(`CREATE TYPE organization.team_role AS ENUM ('leader', 'member')`);
    await q.query(`
      CREATE TABLE organization.team (
        id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        name           varchar(100) NOT NULL CHECK (btrim(name) <> ''),
        active         boolean      NOT NULL DEFAULT true,
        deactivated_at timestamptz  NULL,
        created_at     timestamptz  NOT NULL DEFAULT now()
      )`);
    // RN33: nome único entre equipas ativas, sem distinguir maiúsculas (database.md §5).
    await q.query(`CREATE UNIQUE INDEX team_name_active_uk ON organization.team (lower(name)) WHERE active`);

    await q.query(`
      CREATE TABLE organization.team_membership (
        team_id        uuid                     NOT NULL REFERENCES organization.team (id),
        user_id        uuid                     NOT NULL,
        role           organization.team_role   NOT NULL,
        allocation_pct smallint                 NOT NULL CHECK (allocation_pct BETWEEN 1 AND 100),
        created_at     timestamptz              NOT NULL DEFAULT now(),
        PRIMARY KEY (team_id, user_id)
      )`);
    await q.query(`CREATE INDEX team_membership_user_idx ON organization.team_membership (user_id)`);

    await q.query(`
      CREATE TABLE organization.project (
        id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        name       varchar(100)  NOT NULL,
        objective  varchar(1000) NULL,
        deleted_at timestamptz   NULL,
        created_at timestamptz   NOT NULL DEFAULT now(),
        -- RN42: 3 a 100 caracteres depois de retirar os espaços no início e no fim.
        CONSTRAINT project_name_length_ck CHECK (char_length(btrim(name)) BETWEEN 3 AND 100)
      )`);

    await q.query(`
      CREATE TABLE organization.project_manager (
        project_id uuid NOT NULL REFERENCES organization.project (id),
        user_id    uuid NOT NULL,
        PRIMARY KEY (project_id, user_id)
      )`);
    await q.query(`CREATE INDEX project_manager_user_idx ON organization.project_manager (user_id)`);

    // P06: N:M, sem duplicados (CA01.5); um projeto pode não ter equipas (RN33).
    await q.query(`
      CREATE TABLE organization.project_team (
        project_id uuid NOT NULL REFERENCES organization.project (id),
        team_id    uuid NOT NULL REFERENCES organization.team (id),
        PRIMARY KEY (project_id, team_id)
      )`);
    await q.query(`CREATE INDEX project_team_team_idx ON organization.project_team (team_id)`);

    // history.history_event (database.md §2.6) — só de acrescento (RN32, SEC03, SEC04).
    await q.query(`
      CREATE TYPE history.entity_type AS ENUM (
        'team', 'project', 'objective', 'epic', 'task', 'acceptance_criterion', 'sprint', 'team_membership'
      )`);
    await q.query(`
      CREATE TABLE history.history_event (
        id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        entity_type history.entity_type NOT NULL,
        entity_id   uuid                NOT NULL,
        event_type  text                NOT NULL CHECK (btrim(event_type) <> ''),
        old_value   jsonb               NULL,
        new_value   jsonb               NULL,
        author_id   uuid                NOT NULL,
        occurred_at timestamptz         NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX history_event_entity_idx ON history.history_event (entity_type, entity_id, id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const schema of ['history', 'tracking', 'planning', 'work', 'organization', 'identity']) {
      await q.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
  }
}
