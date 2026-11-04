import { DataSource, QueryRunner } from 'typeorm';
import { buildDataSourceOptions, databaseName } from '../src/shared/database/database.config';

/**
 * Dados de demonstração (I0, Ficha PL 03 Ex. 2), fictícios (SEC08) e idempotentes: só acrescenta o que falta;
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

/** Identificadores fixos dos dados de trabalho, para o seed ser idempotente. */
const id = (n: number) => `7d1f3c2a-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface SeedTask {
  id: string;
  title: string;
  state: string;
  priority: 'low' | 'medium' | 'high';
  createdBy: string;
  assignee?: string;
  hours?: number;
  storyPoints?: number;
  blockReason?: string;
  criteria?: { id: string; text: string; met: boolean }[];
  participants?: string[];
  comments?: { id: string; author: string; body: string }[];
  subtasks?: SeedTask[];
}

/**
 * Hierarquia de demonstração (Ex. 2): objetivo → épico → tarefas e subtarefas, com estados,
 * prioridades, critérios, participantes (atribuições) e comentários. Coerente com RN13 (tarefa
 * terminada com os critérios cumpridos), RN27 (critérios e estimativa a partir de «Pronta»)
 * e RN28 (motivo do bloqueio, sem motivos pessoais — SEC06).
 */
const WORK: {
  projectId: string;
  team: string;
  objective: { id: string; title: string };
  epic: { id: string; title: string };
  tasks: SeedTask[];
}[] = [
  {
    projectId: PROJECTS[0].id,
    team: 'Equipa Alfa',
    objective: { id: id(101), title: 'Lançar a primeira versão do portal' },
    epic: { id: id(201), title: 'Página inicial e pesquisa' },
    tasks: [
      {
        id: id(301),
        title: 'Desenhar a página inicial',
        state: 'done',
        priority: 'high',
        createdBy: 'gestor@matriz.example',
        assignee: 'ana@matriz.example',
        hours: 16,
        storyPoints: 5,
        criteria: [{ id: id(401), text: 'O desenho foi validado pelo gestor do projeto.', met: true }],
      },
      {
        id: id(302),
        title: 'Implementar a pesquisa de ferramentas',
        state: 'in_development',
        priority: 'high',
        createdBy: 'ana@matriz.example',
        assignee: 'rui@matriz.example',
        hours: 24,
        storyPoints: 8,
        criteria: [{ id: id(402), text: 'A pesquisa encontra ferramentas pelo nome.', met: false }],
        participants: ['ana@matriz.example'],
        comments: [
          { id: id(501), author: 'rui@matriz.example', body: 'Comecei pela pesquisa por nome; os filtros ficam para depois.' },
          { id: id(502), author: 'ana@matriz.example', body: 'Combinado. Revejo o código quando estiver em testes.' },
        ],
      },
      {
        id: id(303),
        title: 'Rever a acessibilidade da página inicial',
        state: 'in_planning',
        priority: 'medium',
        createdBy: 'ana@matriz.example',
      },
      {
        id: id(304),
        title: 'Configurar atalhos para as ferramentas mais usadas',
        state: 'in_technical_analysis',
        priority: 'low',
        createdBy: 'rui@matriz.example',
        subtasks: [
          {
            id: id(305),
            title: 'Levantar as ferramentas mais usadas',
            state: 'in_planning',
            priority: 'low',
            createdBy: 'rui@matriz.example',
          },
        ],
      },
    ],
  },
  {
    projectId: PROJECTS[1].id,
    team: 'Equipa Beta',
    objective: { id: id(102), title: 'Digitalizar o arquivo de contratos' },
    epic: { id: id(202), title: 'Digitalização em lote' },
    tasks: [
      {
        id: id(311),
        title: 'Definir o formato dos ficheiros digitalizados',
        state: 'ready_for_development',
        priority: 'medium',
        createdBy: 'admin@matriz.example',
        assignee: 'bruno@matriz.example',
        hours: 8,
        storyPoints: 3,
        criteria: [{ id: id(411), text: 'O formato e a resolução estão documentados.', met: false }],
      },
      {
        id: id(312),
        title: 'Indexar as pastas de contratos',
        state: 'in_planning',
        priority: 'high',
        createdBy: 'bruno@matriz.example',
        blockReason: 'A aguardar acesso ao arquivo físico.',
      },
    ],
  },
];

async function insertCount(q: QueryRunner, sql: string, params: unknown[]): Promise<number> {
  const rows: unknown[] = await q.query(sql, params);
  return rows.length;
}

async function seed(q: QueryRunner): Promise<Record<string, number>> {
  const added = {
    users: 0,
    teams: 0,
    memberships: 0,
    projects: 0,
    managers: 0,
    projectTeams: 0,
    objectives: 0,
    epics: 0,
    tasks: 0,
    criteria: 0,
    participants: 0,
    comments: 0,
  };
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

  const user = (email: string) => userId.get(email);

  async function insertTask(t: SeedTask, team: string, epicId: string | null, parentId: string | null) {
    added.tasks += await insertCount(
      q,
      `INSERT INTO work.task (id, epic_id, parent_task_id, title, team_id, original_team_id, assignee_id,
                              state, estimate_hours, story_points, priority, is_blocked, block_reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [
        t.id,
        epicId,
        parentId,
        t.title,
        teamId.get(team),
        t.assignee ? user(t.assignee) : null,
        t.state,
        t.hours ?? null,
        t.storyPoints ?? null,
        t.priority,
        Boolean(t.blockReason),
        t.blockReason ?? null,
        user(t.createdBy),
      ],
    );
    for (const c of t.criteria ?? []) {
      const metBy = c.met ? user(t.assignee ?? t.createdBy) : null;
      added.criteria += await insertCount(
        q,
        `INSERT INTO work.acceptance_criterion (id, task_id, description, is_met, met_by, met_at, created_by)
         VALUES ($1, $2, $3, $4, $5::uuid, CASE WHEN $4 THEN now() END, $6)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [c.id, t.id, c.text, c.met, metBy, user(t.createdBy)],
      );
    }
    for (const email of t.participants ?? []) {
      added.participants += await insertCount(
        q,
        `INSERT INTO work.task_participant (task_id, user_id, added_by) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING user_id`,
        [t.id, user(email), user(t.createdBy)],
      );
    }
    for (const c of t.comments ?? []) {
      added.comments += await insertCount(
        q,
        `INSERT INTO work.comment (id, task_id, author_id, body) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [c.id, t.id, user(c.author), c.body],
      );
    }
    for (const s of t.subtasks ?? []) await insertTask(s, team, null, t.id);
  }

  for (const w of WORK) {
    added.objectives += await insertCount(
      q,
      `INSERT INTO work.objective (id, project_id, title) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [w.objective.id, w.projectId, w.objective.title],
    );
    added.epics += await insertCount(
      q,
      `INSERT INTO work.epic (id, objective_id, title) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [w.epic.id, w.objective.id, w.epic.title],
    );
    for (const t of w.tasks) await insertTask(t, w.team, w.epic.id, null);
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
