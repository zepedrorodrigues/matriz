import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { CryptoKey, JWTPayload } from 'jose';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { requireEnv } from '../../src/shared/config/load-env';
import { OIDC_KEY_SET } from '../../src/modules/identity/token-verifier.service';

/**
 * Aplicação de teste: a mesma AppModule, com as chaves públicas do fornecedor substituídas por
 * um par de chaves gerado no teste. Os tokens são assinados aqui com o emissor e a audiência
 * configurados (OIDC_ISSUER, OIDC_AUDIENCE), por isso o Keycloak não precisa de estar a correr.
 */
export class TestApp {
  private constructor(
    readonly app: INestApplication,
    readonly db: DataSource,
    private readonly privateKey: CryptoKey,
    private readonly kid: string,
  ) {}

  static async create(): Promise<TestApp> {
    const kid = randomUUID();
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OIDC_KEY_SET)
      .useValue(createLocalJWKSet({ keys: [jwk] }))
      .compile();
    const app = configureApp(moduleRef.createNestApplication());
    await app.init();
    return new TestApp(app, app.get(DataSource), privateKey, kid);
  }

  get server() {
    return this.app.getHttpServer();
  }

  /** Token como o do Keycloak: `sub`, `email`, `email_verified`, emissor e audiência configurados. */
  async token(
    claims: JWTPayload & { email?: string; email_verified?: boolean },
    options: { issuer?: string; audience?: string; expiresIn?: string | number; key?: CryptoKey } = {},
  ): Promise<string> {
    const jwt = new SignJWT({ email_verified: true, ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuer(options.issuer ?? requireEnv('OIDC_ISSUER'))
      .setAudience(options.audience ?? requireEnv('OIDC_AUDIENCE'))
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m');
    if (claims.sub === undefined) jwt.setSubject(randomUUID());
    return jwt.sign(options.key ?? this.privateKey);
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

/** Dados de teste criados diretamente na base de testes (ids aleatórios, e-mails fictícios). */
export class Fixtures {
  constructor(private readonly db: DataSource) {}

  async user(name: string, opts: { isAdmin?: boolean; active?: boolean; externalSubject?: string } = {}) {
    const email = `${name.toLowerCase()}.${randomUUID().slice(0, 8)}@matriz.example`;
    const [row] = await this.db.query(
      `INSERT INTO identity."user" (name, work_email, is_admin, active, deactivated_at, external_subject)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NULL ELSE now() END, $5) RETURNING id`,
      [name, email, opts.isAdmin ?? false, opts.active ?? true, opts.externalSubject ?? null],
    );
    return { id: row.id as string, email, name };
  }

  async team(name: string, members: { userId: string; role: 'leader' | 'member' }[]) {
    const [row] = await this.db.query(`INSERT INTO organization.team (name) VALUES ($1) RETURNING id`, [
      `${name} ${randomUUID().slice(0, 8)}`,
    ]);
    for (const m of members) {
      await this.db.query(
        `INSERT INTO organization.team_membership (team_id, user_id, role, allocation_pct) VALUES ($1, $2, $3, 100)`,
        [row.id, m.userId, m.role],
      );
    }
    return row.id as string;
  }

  async project(name: string, opts: { managers?: string[]; teams?: string[]; deleted?: boolean } = {}) {
    const [row] = await this.db.query(
      `INSERT INTO organization.project (name, deleted_at) VALUES ($1, CASE WHEN $2 THEN now() END) RETURNING id`,
      [name, opts.deleted ?? false],
    );
    for (const userId of opts.managers ?? []) {
      await this.db.query(`INSERT INTO organization.project_manager (project_id, user_id) VALUES ($1, $2)`, [row.id, userId]);
    }
    for (const teamId of opts.teams ?? []) {
      await this.db.query(`INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)`, [row.id, teamId]);
    }
    return row.id as string;
  }

  async objective(projectId: string, title = 'Objetivo') {
    const [row] = await this.db.query(`INSERT INTO work.objective (project_id, title) VALUES ($1, $2) RETURNING id`, [
      projectId,
      title,
    ]);
    return row.id as string;
  }

  async epic(objectiveId: string, title = 'Épico') {
    const [row] = await this.db.query(`INSERT INTO work.epic (objective_id, title) VALUES ($1, $2) RETURNING id`, [
      objectiveId,
      title,
    ]);
    return row.id as string;
  }

  /** Tarefa (com `epicId`) ou subtarefa (com `parentTaskId`), criada diretamente na base. */
  async task(opts: {
    epicId?: string;
    parentTaskId?: string;
    teamId: string;
    createdBy: string;
    title?: string;
    state?: string;
    priority?: string;
    assigneeId?: string;
    estimateHours?: number;
    storyPoints?: number;
  }) {
    const [row] = await this.db.query(
      `INSERT INTO work.task (epic_id, parent_task_id, title, team_id, original_team_id, assignee_id, state, priority,
                              estimate_hours, story_points, created_by)
       VALUES ($1, $2, $3, $4, $4, $5, $6::work.task_state, $7::work.task_priority, $8, $9, $10) RETURNING id`,
      [
        opts.epicId ?? null,
        opts.parentTaskId ?? null,
        opts.title ?? 'Tarefa de teste',
        opts.teamId,
        opts.assigneeId ?? null,
        opts.state ?? 'in_planning',
        opts.priority ?? 'medium',
        opts.estimateHours ?? null,
        opts.storyPoints ?? null,
        opts.createdBy,
      ],
    );
    return row.id as string;
  }

  async criterion(taskId: string, createdBy: string, met = false) {
    const [row] = await this.db.query(
      `INSERT INTO work.acceptance_criterion (task_id, description, is_met, met_by, met_at, created_by)
       VALUES ($1, 'Critério de teste', $2, CASE WHEN $2 THEN $3::uuid END, CASE WHEN $2 THEN now() END, $3) RETURNING id`,
      [taskId, met, createdBy],
    );
    return row.id as string;
  }

  async externalSubjectOf(userId: string): Promise<string | null> {
    const [row] = await this.db.query(`SELECT external_subject FROM identity."user" WHERE id = $1`, [userId]);
    return row.external_subject;
  }
}
