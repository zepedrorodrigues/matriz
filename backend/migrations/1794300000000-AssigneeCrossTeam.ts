import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ficha PL 04, Ex. 5 (decisão 1a, F24): a tarefa guarda se a atribuição atual é a exceção do RN03 — alguém de
 * outra equipa, atribuído pelo gestor ou pelo administrador com justificação. Só essa exceção dá ao
 * responsável os direitos do membro na tarefa (F23); quem sai da equipa deixa de os ter.
 *
 * Preenchimento: as tarefas cuja última atribuição registada no histórico foi a outra equipa (`crossTeam`)
 * e cujo responsável continua o mesmo. Lê o histórico só nesta migração, uma vez.
 */
export class AssigneeCrossTeam1794300000000 implements MigrationInterface {
  name = 'AssigneeCrossTeam1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE work.task ADD COLUMN assignee_cross_team boolean NOT NULL DEFAULT false`);
    await q.query(`
      UPDATE work.task t SET assignee_cross_team = true
      FROM (
        SELECT DISTINCT ON (entity_id) entity_id, new_value
        FROM history.history_event
        WHERE entity_type = 'task' AND event_type = 'assignee_changed'
        ORDER BY entity_id, id DESC
      ) last
      WHERE last.entity_id = t.id
        AND (last.new_value->>'crossTeam')::boolean IS TRUE
        AND (last.new_value->>'assigneeId')::uuid = t.assignee_id`);
    await q.query(
      `ALTER TABLE work.task ADD CONSTRAINT task_cross_team_assignee_ck CHECK (NOT assignee_cross_team OR assignee_id IS NOT NULL)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE work.task DROP CONSTRAINT task_cross_team_assignee_ck`);
    await q.query(`ALTER TABLE work.task DROP COLUMN assignee_cross_team`);
  }
}
