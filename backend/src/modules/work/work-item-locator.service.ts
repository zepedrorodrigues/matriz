import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { TaskLocation, TaskState, WorkItemLocator } from '../../shared/ports/work-item-locator';

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
      `SELECT o.project_id, t.team_id, t.assignee_id, t.parent_task_id, t.state, t.created_by
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
      createdBy: row.created_by,
    };
  }

  async projectOfObjective(objectiveId: string): Promise<string | null> {
    const [row] = await this.db.query(`SELECT project_id FROM work.objective WHERE id = $1`, [objectiveId]);
    return row?.project_id ?? null;
  }

  /** Uma tarefa de topo tem épico; uma subtarefa não (RN12, RN22), por isso a junção pelo épico exclui-as. */
  async taskCountsByProject(projectIds: string[]): Promise<Map<string, Partial<Record<TaskState, number>>>> {
    const counts = new Map<string, Partial<Record<TaskState, number>>>();
    if (projectIds.length === 0) return counts;
    const rows: { project_id: string; state: TaskState; n: number }[] = await this.db.query(
      `SELECT o.project_id, t.state, count(*)::int AS n
       FROM work.task t JOIN work.epic e ON e.id = t.epic_id JOIN work.objective o ON o.id = e.objective_id
       WHERE o.project_id = ANY($1::uuid[]) AND t.parent_task_id IS NULL AND t.deleted_at IS NULL
       GROUP BY o.project_id, t.state`,
      [projectIds],
    );
    for (const r of rows) counts.set(r.project_id, { ...counts.get(r.project_id), [r.state]: r.n });
    return counts;
  }
}
