import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { TaskLocation, WorkItemLocator } from '../../shared/ports/work-item-locator';

/** Implementação de WorkItemLocator pelo módulo dono das tabelas do Trabalho (architecture.md §6). */
@Injectable()
export class WorkItemLocatorService implements WorkItemLocator {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * A tarefa herda o projeto do épico; a subtarefa, do épico da tarefa principal (RN23). Uma subtarefa
   * cuja tarefa principal foi eliminada também conta como eliminada (RN38).
   */
  async locateTask(taskId: string): Promise<TaskLocation | null> {
    const [row] = await this.db.query(
      `SELECT o.project_id, t.team_id, t.assignee_id, t.parent_task_id, t.state
       FROM work.task t
       LEFT JOIN work.task p ON p.id = t.parent_task_id
       JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
       JOIN work.objective o ON o.id = e.objective_id
       WHERE t.id = $1 AND t.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)`,
      [taskId],
    );
    if (!row) return null;
    return {
      projectId: row.project_id,
      teamId: row.team_id,
      assigneeId: row.assignee_id,
      parentTaskId: row.parent_task_id,
      state: row.state,
    };
  }

  async projectOfObjective(objectiveId: string): Promise<string | null> {
    const [row] = await this.db.query(`SELECT project_id FROM work.objective WHERE id = $1`, [objectiveId]);
    return row?.project_id ?? null;
  }
}
