import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/shared/database/database.config';

/**
 * Ex. 2 — regras de integridade do módulo Trabalho garantidas pela base de dados (database.md §5).
 * Corre na base de testes (NODE_ENV=test), recriada pelas migrations no globalSetup.
 */
describe('Ex. 2 — esquema do módulo Trabalho', () => {
  let db: DataSource;
  const actor = randomUUID();
  const team = randomUUID();
  let epicId: string;
  let taskId: string;

  const insertTask = (title: string, extra: Record<string, unknown> = {}) => {
    const cols = { epic_id: epicId, parent_task_id: null, title, team_id: team, original_team_id: team, created_by: actor, ...extra };
    const names = Object.keys(cols);
    return db.query(
      `INSERT INTO work.task (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id, state, priority`,
      Object.values(cols),
    );
  };

  beforeAll(async () => {
    db = new DataSource(buildDataSourceOptions());
    await db.initialize();
    const [objective] = await db.query(`INSERT INTO work.objective (project_id, title) VALUES ($1, 'Objetivo') RETURNING id`, [randomUUID()]);
    const [epic] = await db.query(`INSERT INTO work.epic (objective_id, title) VALUES ($1, 'Épico') RETURNING id`, [objective.id]);
    epicId = epic.id;
    [{ id: taskId }] = await insertTask('Tarefa válida');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('RN39, RN17 — uma tarefa nova fica «Em planeamento» com prioridade média', async () => {
    const [row] = await db.query(`SELECT state, priority FROM work.task WHERE id = $1`, [taskId]);
    expect(row).toEqual({ state: 'in_planning', priority: 'medium' });
  });

  it('RN42 — rejeita títulos de tarefa só com espaços, com menos de 3 ou mais de 150 caracteres', async () => {
    await expect(insertTask('     ')).rejects.toThrow(/task_title_length_ck/);
    await expect(insertTask('  ab  ')).rejects.toThrow(/task_title_length_ck/);
    await expect(insertTask('x'.repeat(151))).rejects.toThrow();
  });

  it('RN12, RN22 — uma tarefa tem épico ou tarefa principal, nunca os dois nem nenhum', async () => {
    await expect(insertTask('Sem pai', { epic_id: null })).rejects.toThrow(/task_epic_xor_parent_ck/);
    await expect(insertTask('Dois pais', { parent_task_id: taskId })).rejects.toThrow(/task_epic_xor_parent_ck/);
    await expect(insertTask('Subtarefa', { epic_id: null, parent_task_id: taskId })).resolves.toHaveLength(1);
  });

  it('RN07 — só aceita story points da escala 1, 2, 3, 5, 8, 13, 21', async () => {
    await expect(insertTask('Pontos inválidos', { story_points: 4 })).rejects.toThrow();
    await expect(insertTask('Pontos válidos', { story_points: 13 })).resolves.toHaveLength(1);
  });

  it('RN28 — uma tarefa bloqueada exige o motivo', async () => {
    await expect(insertTask('Bloqueada sem motivo', { is_blocked: true })).rejects.toThrow(/task_block_reason_ck/);
  });

  it('RN40, CA03.14 — não aceita o mesmo participante duas vezes na mesma tarefa', async () => {
    const user = randomUUID();
    const add = () => db.query(`INSERT INTO work.task_participant (task_id, user_id, added_by) VALUES ($1, $2, $3)`, [taskId, user, actor]);
    await add();
    await expect(add()).rejects.toThrow(/duplicate key/);
  });

  it('RN41 — rejeita comentários vazios, só com espaços ou com mais de 2000 caracteres', async () => {
    const add = (body: string) => db.query(`INSERT INTO work.comment (task_id, author_id, body) VALUES ($1, $2, $3)`, [taskId, actor, body]);
    await expect(add('')).rejects.toThrow();
    await expect(add('   ')).rejects.toThrow();
    await expect(add('x'.repeat(2001))).rejects.toThrow();
    await expect(add('Comentário válido')).resolves.toBeDefined();
  });
});
