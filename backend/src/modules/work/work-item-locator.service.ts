import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { todaySql } from '../../shared/config/time-zone';
import { DONE_STATES_SQL, type PlanningTaskInfo, type TaskLocation, type TaskState, type WorkItemLocator } from '../../shared/ports/work-item-locator';

/** Implementação de WorkItemLocator pelo módulo dono das tabelas do Trabalho (architecture.md §6). */
@Injectable()
export class WorkItemLocatorService implements WorkItemLocator {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * A tarefa herda o projeto do épico; a subtarefa, do épico da tarefa principal (RN23). Uma subtarefa
   * cuja tarefa principal foi eliminada também conta como eliminada (RN38).
   */
  async locateTask(taskId: string, manager?: EntityManager): Promise<TaskLocation | null> {
    const [row] = await (manager ?? this.db).query(
      `SELECT o.project_id, t.team_id, t.assignee_id, t.assignee_cross_team, t.parent_task_id, t.state, t.created_by
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
      assigneeCrossTeam: row.assignee_cross_team,
      parentTaskId: row.parent_task_id,
      state: row.state,
      createdBy: row.created_by,
    };
  }

  async lockTasks(taskIds: string[], manager: EntityManager): Promise<void> {
    if (taskIds.length === 0) return;
    await manager.query(`SELECT id FROM work.task WHERE id = ANY($1) ORDER BY id FOR SHARE`, [taskIds]);
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

  async overdueTasks(today: string): Promise<{ id: string; teamId: string; projectId: string; assigneeId: string | null; dueDate: string }[]> {
    const rows: { id: string; team_id: string; project_id: string; assignee_id: string | null; due_date: string }[] = await this.db.query(
      `SELECT t.id, t.team_id, o.project_id, t.assignee_id, to_char(t.due_date, 'YYYY-MM-DD') AS due_date
       FROM work.task t
       LEFT JOIN work.task p ON p.id = t.parent_task_id
       JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
       JOIN work.objective o ON o.id = e.objective_id
       WHERE t.due_date < $1::date AND t.state NOT IN (${DONE_STATES_SQL})
         AND t.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)`,
      [today],
    );
    return rows.map((r) => ({ id: r.id, teamId: r.team_id, projectId: r.project_id, assigneeId: r.assignee_id, dueDate: r.due_date }));
  }

  async openTaskCountsOfTeam(teamId: string): Promise<{ projectId: string; count: number }[]> {
    const rows: { project_id: string; n: number }[] = await this.db.query(
      `SELECT o.project_id, count(*)::int AS n
       FROM work.task t
       LEFT JOIN work.task p ON p.id = t.parent_task_id
       JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
       JOIN work.objective o ON o.id = e.objective_id
       WHERE t.team_id = $1 AND t.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)
         AND t.state NOT IN (${DONE_STATES_SQL})
       GROUP BY o.project_id`,
      [teamId],
    );
    return rows.map((r) => ({ projectId: r.project_id, count: r.n }));
  }

  /** Com `manager`, lê na transação em curso (p. ex. para recalcular a sobrecarga com as alterações por confirmar). */
  async planningTasks(query: { teamId: string } | { taskIds: string[] }, manager?: EntityManager): Promise<PlanningTaskInfo[]> {
    const byTeam = 'teamId' in query;
    if (!byTeam && query.taskIds.length === 0) return [];
    const rows: {
      id: string;
      title: string;
      project_id: string;
      team_id: string;
      parent_task_id: string | null;
      state: TaskState;
      priority: PlanningTaskInfo['priority'];
      estimate_hours: string | null;
      story_points: number | null;
      subtask_count: number;
      subtask_hours: string | null;
      subtask_points: number | null;
      assignee_id: string | null;
      assignee_cross_team: boolean;
      created_at: Date;
      due_date: string | null;
      is_overdue: boolean;
      is_blocked: boolean;
      block_reason: string | null;
    }[] = await (manager ?? this.db).query(
      `SELECT t.id, t.title, o.project_id, t.team_id, t.parent_task_id, t.state, t.priority, t.estimate_hours,
              t.story_points, t.assignee_id, t.assignee_cross_team, t.created_at, s.subtask_count, s.subtask_hours, s.subtask_points,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.is_blocked, t.block_reason,
              coalesce(t.due_date < ${todaySql()} AND t.state NOT IN (${DONE_STATES_SQL}), false) AS is_overdue
       FROM work.task t
       LEFT JOIN work.task p ON p.id = t.parent_task_id
       JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
       JOIN work.objective o ON o.id = e.objective_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS subtask_count, sum(st.estimate_hours) AS subtask_hours, sum(st.story_points)::int AS subtask_points
         FROM work.task st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL
       ) s ON true
       WHERE ${byTeam ? 't.team_id = $1' : 't.id = ANY($1::uuid[])'}
         AND t.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)
       ORDER BY t.created_at DESC, t.id`,
      [byTeam ? query.teamId : query.taskIds],
    );
    return rows.map((r) => {
      const sum = r.subtask_count > 0;
      const hours = sum ? r.subtask_hours : r.estimate_hours;
      return {
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        teamId: r.team_id,
        parentTaskId: r.parent_task_id,
        state: r.state,
        priority: r.priority,
        estimateHours: hours === null ? null : Number(hours),
        storyPoints: sum ? r.subtask_points : r.story_points,
        hasSubtasks: sum,
        dueDate: r.due_date,
        isOverdue: r.is_overdue,
        isBlocked: r.is_blocked,
        blockReason: r.block_reason,
        assigneeId: r.assignee_id,
        assigneeCrossTeam: r.assignee_cross_team,
        createdAt: r.created_at.toISOString(),
      };
    });
  }
}
