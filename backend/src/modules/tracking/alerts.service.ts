import { Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents, type ChangeEvent } from '../../shared/events/domain-events';
import { CAPACITY_READER, type CapacityReader } from '../../shared/ports/capacity-reader';
import type { DailyTask } from '../../shared/ports/daily-task';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { WORK_ITEM_LOCATOR, type TaskState, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';

export type AlertType = 'deadline_passed' | 'task_blocked' | 'task_reopened' | 'member_task_created' | 'team_overload' | 'individual_overload';

export interface Alert {
  id: string;
  type: AlertType;
  createdAt: string;
  readAt: string | null;
  task: { id: string; title: string; state: TaskState; isBlocked: boolean; blockReason: string | null } | null;
  team: { id: string; name: string; active: boolean } | null;
  member: { id: string; name: string } | null;
  sprintId: string | null;
  dueDate: string | null;
}

export interface AlertPage {
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
  items: Alert[];
}

interface AlertRow {
  id: string;
  type: AlertType;
  task_id: string | null;
  team_id: string | null;
  sprint_id: string | null;
  user_id: string | null;
  due_date: string | null;
  created_at: Date;
  read_at: Date | null;
}

/** Eventos de planeamento que podem mudar a sobrecarga de uma sprint (CA05.8; F21). */
const SPRINT_EVENTS = new Set(['task_planned', 'task_added', 'task_removed', 'started', 'availability_adjusted', 'availability_reset', 'dates_changed']);
/** Eventos de tarefas que podem mudar a sobrecarga das sprints em aberto em que estão (F21). */
const TASK_LOAD_EVENTS = new Set(['estimate_changed', 'assignee_changed', 'deleted']);
const ALERT_COLUMNS = `id, type, task_id, team_id, sprint_id, user_id, to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at, read_at`;

/**
 * Alertas na aplicação (US07; CA05.8, CA07.5, CA07.7, CA07.8, CA08.2; RN09, RN18, RN19, RN30; DT07; SEC07),
 * no módulo Acompanhamento. Subscreve os eventos de domínio e cria os alertas na mesma transação do evento
 * que os origina, para nunca ficar uma alteração gravada sem o seu alerta. Os destinatários seguem RN30:
 * bloqueio → líderes da equipa; reabertura → responsável e líderes; tarefa criada por um membro → líderes
 * (RN09); sobrecarga da equipa → líderes e membros; sobrecarga individual → a pessoa e os líderes (RN19);
 * prazo ultrapassado (tarefa diária) → responsável e líderes. Cada pessoa vê só os seus (SEC07).
 */
@Injectable()
export class AlertsService implements OnModuleInit, DailyTask {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
    @Inject(CAPACITY_READER) private readonly capacity: CapacityReader,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  onModuleInit(): void {
    this.events.subscribe((event, manager) => this.onEvent(event, manager));
  }

  private async onEvent(event: ChangeEvent, m: EntityManager): Promise<void> {
    if (event.entityType === 'task') {
      const taskId = event.entityId;
      if (event.eventType === 'blocked') {
        const task = await this.work.locateTask(taskId);
        if (task) await this.insert(m, await this.leaders(task.teamId), { type: 'task_blocked', taskId, teamId: task.teamId });
      } else if (event.eventType === 'reopened') {
        const task = await this.work.locateTask(taskId);
        if (task) {
          const to = [...(task.assigneeId ? [task.assigneeId] : []), ...(await this.leaders(task.teamId))];
          await this.insert(m, to, { type: 'task_reopened', taskId, teamId: task.teamId });
        }
      } else if (event.eventType === 'created') {
        // RN09, CA08.2: só quando quem cria é membro (não líder) da equipa da tarefa.
        const teamId = (event.newValue as { teamId?: string } | null)?.teamId;
        if (teamId && (await this.organization.teamRole(event.authorId, teamId)) === 'member') {
          await this.insert(m, await this.leaders(teamId), { type: 'member_task_created', taskId, teamId });
        }
      }
      if (TASK_LOAD_EVENTS.has(event.eventType)) {
        for (const sprintId of await this.capacity.openSprintsOfTask(taskId, m)) await this.checkOverload(sprintId, m);
      }
    } else if (event.entityType === 'sprint' && SPRINT_EVENTS.has(event.eventType)) {
      await this.checkOverload(event.entityId, m);
    }
  }

  /**
   * CA05.8, RN19, F21: alerta na passagem de não sobrecarregado a sobrecarregado (a equipa ou cada membro) e
   * não repete enquanto durar; quando deixa de estar, a marca sai e uma nova passagem volta a alertar.
   */
  private async checkOverload(sprintId: string, m: EntityManager): Promise<void> {
    const state = await this.capacity.overloadState(sprintId, m);
    if (!state) return;
    const members = await this.organization.teamMembers(state.teamId);
    const leaders = members.filter((x) => x.role === 'leader').map((x) => x.userId);
    const flags = new Set(
      ((await m.query(`SELECT subject_id FROM tracking.overload_flag WHERE sprint_id = $1`, [sprintId])) as { subject_id: string }[]).map(
        (r) => r.subject_id,
      ),
    );
    const subjects: { id: string; overloaded: boolean; to: string[]; type: AlertType; userId?: string }[] = [
      { id: state.teamId, overloaded: state.team, to: members.map((x) => x.userId), type: 'team_overload' },
      ...members.map((x) => ({
        id: x.userId,
        overloaded: state.users.includes(x.userId),
        to: [x.userId, ...leaders],
        type: 'individual_overload' as const,
        userId: x.userId,
      })),
    ];
    for (const s of subjects) {
      if (s.overloaded && !flags.has(s.id)) {
        await m.query(`INSERT INTO tracking.overload_flag (sprint_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [sprintId, s.id]);
        await this.insert(m, s.to, { type: s.type, teamId: state.teamId, sprintId, userId: s.userId });
      } else if (!s.overloaded && flags.has(s.id)) {
        await m.query(`DELETE FROM tracking.overload_flag WHERE sprint_id = $1 AND subject_id = $2`, [sprintId, s.id]);
      }
    }
  }

  /**
   * CA07.7, RN30 (tarefa diária): tarefas com o prazo ultrapassado e não concluídas → o responsável e os
   * líderes da equipa; um alerta por tarefa, destinatário e prazo (F21), por isso pode correr várias vezes.
   */
  async run(today: string): Promise<void> {
    const overdue = await this.work.overdueTasks(today);
    const live = await this.organization.projectNames([...new Set(overdue.map((t) => t.projectId))]);
    await this.db.transaction(async (m) => {
      for (const t of overdue.filter((x) => live.has(x.projectId))) {
        const to = [...new Set([...(t.assigneeId ? [t.assigneeId] : []), ...(await this.leaders(t.teamId))])];
        for (const recipient of to) {
          await m.query(
            `INSERT INTO tracking.alert (recipient_id, type, task_id, team_id, due_date) VALUES ($1, 'deadline_passed', $2, $3, $4)
             ON CONFLICT (task_id, recipient_id, due_date) WHERE type = 'deadline_passed' DO NOTHING`,
            [recipient, t.id, t.teamId, t.dueDate],
          );
        }
      }
    });
  }

  /** SEC07: só os alertas do utilizador; mais recentes primeiro, com o total e os não lidos. */
  async list(user: AuthenticatedUser, page: number, pageSize: number): Promise<AlertPage> {
    const [{ total, unread }] = await this.db.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE read_at IS NULL)::int AS unread FROM tracking.alert WHERE recipient_id = $1`,
      [user.id],
    );
    const rows: AlertRow[] = await this.db.query(
      `SELECT ${ALERT_COLUMNS} FROM tracking.alert WHERE recipient_id = $1 ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`,
      [user.id, pageSize, (page - 1) * pageSize],
    );
    return { page, pageSize, total, unreadCount: unread, items: await this.describe(rows) };
  }

  /** Só o destinatário; o alerta de outra pessoa responde como inexistente (SEC07). */
  async markRead(user: AuthenticatedUser, alertId: string): Promise<Alert> {
    const [rows]: [AlertRow[], number] = await this.db.query(
      `UPDATE tracking.alert SET read_at = coalesce(read_at, now()) WHERE id = $1 AND recipient_id = $2 RETURNING ${ALERT_COLUMNS}`,
      [alertId, user.id],
    );
    if (rows.length === 0) throw new NotFoundException('O alerta não existe.');
    const [alert] = await this.describe(rows);
    return alert;
  }

  private async describe(rows: AlertRow[]): Promise<Alert[]> {
    const taskIds = [...new Set(rows.flatMap((r) => (r.task_id ? [r.task_id] : [])))];
    const [tasks, teams, names] = await Promise.all([
      this.work.planningTasks({ taskIds }),
      this.organization.teamNames([...new Set(rows.flatMap((r) => (r.team_id && !r.task_id ? [r.team_id] : [])))]),
      this.users.namesByIds([...new Set(rows.flatMap((r) => (r.user_id ? [r.user_id] : [])))]),
    ]);
    const live = await this.organization.projectNames([...new Set(tasks.map((t) => t.projectId))]);
    const byId = new Map(tasks.filter((t) => live.has(t.projectId)).map((t) => [t.id, t]));
    return rows.map((r) => {
      const t = r.task_id ? byId.get(r.task_id) : undefined;
      const team = r.team_id && !r.task_id ? teams.get(r.team_id) : undefined;
      return {
        id: r.id,
        type: r.type,
        createdAt: r.created_at.toISOString(),
        readAt: r.read_at ? r.read_at.toISOString() : null,
        task: t ? { id: t.id, title: t.title, state: t.state, isBlocked: t.isBlocked, blockReason: t.blockReason } : null,
        team: team ? { id: r.team_id!, ...team } : null,
        member: r.user_id ? { id: r.user_id, name: names.get(r.user_id) ?? '' } : null,
        sprintId: r.sprint_id,
        dueDate: r.due_date,
      };
    });
  }

  private async leaders(teamId: string): Promise<string[]> {
    return (await this.organization.teamMembers(teamId)).filter((x) => x.role === 'leader').map((x) => x.userId);
  }

  private async insert(
    m: EntityManager,
    recipients: string[],
    alert: { type: AlertType; taskId?: string; teamId?: string; sprintId?: string; userId?: string },
  ): Promise<void> {
    for (const recipient of [...new Set(recipients)]) {
      await m.query(`INSERT INTO tracking.alert (recipient_id, type, task_id, team_id, sprint_id, user_id) VALUES ($1, $2, $3, $4, $5, $6)`, [
        recipient,
        alert.type,
        alert.taskId ?? null,
        alert.teamId ?? null,
        alert.sprintId ?? null,
        alert.userId ?? null,
      ]);
    }
  }
}
