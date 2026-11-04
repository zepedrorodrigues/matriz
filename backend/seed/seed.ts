import { DataSource, QueryRunner } from 'typeorm';
import { buildDataSourceOptions, databaseName } from '../src/shared/database/database.config';

/**
 * Dados de demonstração (I0), fictícios (SEC08) e idempotentes: só acrescenta o que falta;
 * nunca altera nem apaga dados existentes. As contas correspondem às do realm
 * keycloak/realm-matriz.json, exceto `sem-conta`, que existe só no Keycloak (token válido sem
 * conta na Matriz → 403, CAT02). A ligação ao fornecedor (external_subject) faz-se no primeiro
 * acesso (RN35).
 *
 * Acessos distintos (requirements.md §3.1):
 * - admin: administrador, vê todos os projetos;
 * - gestor: gestor do projeto Portal Interno;
 * - ana (líder) e rui (membro) da Equipa Alfa, associada ao Portal Interno;
 * - bruno (líder) da Equipa Beta, associada ao projeto Arquivo Digital (gerido pelo admin).
 */

const USERS = [
  { email: 'admin@matriz.example', name: 'Alice Admin', isAdmin: true },
  { email: 'gestor@matriz.example', name: 'Gonçalo Gestor', isAdmin: false },
  { email: 'ana@matriz.example', name: 'Ana Exemplo', isAdmin: false },
  { email: 'rui@matriz.example', name: 'Rui Exemplo', isAdmin: false },
  { email: 'bruno@matriz.example', name: 'Bruno Beta', isAdmin: false },
];

const TEAMS = [
  {
    name: 'Equipa Alfa',
    members: [
      { email: 'ana@matriz.example', role: 'leader' },
      { email: 'rui@matriz.example', role: 'member' },
    ],
  },
  { name: 'Equipa Beta', members: [{ email: 'bruno@matriz.example', role: 'leader' }] },
];

const PROJECTS = [
  {
    id: '7d1f3c2a-0000-4000-8000-000000000001',
    name: 'Portal Interno',
    objective: 'Disponibilizar aos colaboradores um ponto único de acesso às ferramentas internas.',
    managers: ['gestor@matriz.example'],
    teams: ['Equipa Alfa'],
  },
  {
    id: '7d1f3c2a-0000-4000-8000-000000000002',
    name: 'Arquivo Digital',
    objective: 'Digitalizar e indexar o arquivo documental da empresa.',
    managers: ['admin@matriz.example'],
    teams: ['Equipa Beta'],
  },
];

async function insertCount(q: QueryRunner, sql: string, params: unknown[]): Promise<number> {
  const rows: unknown[] = await q.query(sql, params);
  return rows.length;
}

async function seed(q: QueryRunner): Promise<Record<string, number>> {
  const added = { users: 0, teams: 0, memberships: 0, projects: 0, managers: 0, projectTeams: 0 };
  const userId = new Map<string, string>();
  const teamId = new Map<string, string>();

  for (const u of USERS) {
    added.users += await insertCount(
      q,
      `INSERT INTO identity."user" (name, work_email, is_admin)
       SELECT $1::text, $2::text, $3::boolean
       WHERE NOT EXISTS (SELECT 1 FROM identity."user" WHERE lower(work_email) = lower($2::text))
       RETURNING id`,
      [u.name, u.email, u.isAdmin],
    );
    const [row] = await q.query(`SELECT id FROM identity."user" WHERE lower(work_email) = lower($1)`, [u.email]);
    userId.set(u.email, row.id);
  }

  for (const t of TEAMS) {
    added.teams += await insertCount(
      q,
      `INSERT INTO organization.team (name)
       SELECT $1::varchar
       WHERE NOT EXISTS (SELECT 1 FROM organization.team WHERE active AND lower(name) = lower($1::varchar))
       RETURNING id`,
      [t.name],
    );
    const [row] = await q.query(`SELECT id FROM organization.team WHERE active AND lower(name) = lower($1)`, [t.name]);
    teamId.set(t.name, row.id);

    // Só para quem ainda não tem pertenças: a soma das alocações de cada pessoa é 100 (RN06).
    for (const m of t.members) {
      added.memberships += await insertCount(
        q,
        `INSERT INTO organization.team_membership (team_id, user_id, role, allocation_pct)
         SELECT $1::uuid, $2::uuid, $3::organization.team_role, 100
         WHERE NOT EXISTS (SELECT 1 FROM organization.team_membership WHERE user_id = $2::uuid)
         RETURNING user_id`,
        [row.id, userId.get(m.email), m.role],
      );
    }
  }

  for (const p of PROJECTS) {
    added.projects += await insertCount(
      q,
      `INSERT INTO organization.project (id, name, objective) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [p.id, p.name, p.objective],
    );
    for (const email of p.managers) {
      added.managers += await insertCount(
        q,
        `INSERT INTO organization.project_manager (project_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING user_id`,
        [p.id, userId.get(email)],
      );
    }
    for (const team of p.teams) {
      added.projectTeams += await insertCount(
        q,
        `INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING team_id`,
        [p.id, teamId.get(team)],
      );
    }
  }
  return added;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('O seed de demonstração não corre em produção.');
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();
  try {
    await q.startTransaction();
    const added = await seed(q);
    await q.commitTransaction();
    console.log(`Seed aplicado na base ${databaseName()}. Linhas acrescentadas:`, added);
  } catch (error) {
    if (q.isTransactionActive) await q.rollbackTransaction();
    throw error;
  } finally {
    await q.release();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
