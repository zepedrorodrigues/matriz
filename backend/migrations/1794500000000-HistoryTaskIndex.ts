import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I13, passo 3 (D50): índices para o histórico agregado de uma tarefa, sem mudar a tabela nem as linhas
 * existentes (SEC04 — nada de UPDATE para preencher uma coluna nova):
 * - eventos de critérios e de sprints que referem a tarefa em `new_value->>'taskId'`;
 * - fim da sprint (`closed`) que a devolveu ao backlog, em `new_value->'returnedToBacklog'` (lista).
 */
export class HistoryTaskIndex1794500000000 implements MigrationInterface {
  name = 'HistoryTaskIndex1794500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE INDEX history_event_task_ref_idx ON history.history_event ((new_value->>'taskId'), id)
      WHERE entity_type IN ('acceptance_criterion', 'sprint')`);
    await q.query(`
      CREATE INDEX history_event_returned_idx ON history.history_event USING gin ((new_value->'returnedToBacklog'))
      WHERE entity_type = 'sprint' AND event_type = 'closed'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX history.history_event_returned_idx`);
    await q.query(`DROP INDEX history.history_event_task_ref_idx`);
  }
}
