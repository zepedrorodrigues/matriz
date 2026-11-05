import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { todaySql } from '../../shared/config/time-zone';
import { DomainEvents } from '../../shared/events/domain-events';
import { SPRINT_LOCATOR, type SprintLocator } from '../../shared/ports/sprint-locator';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import type { TaskState } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';
import { checkTransition } from './task-lifecycle';
import type { CreateTaskDto, Priority, UpdateTaskDto } from './work.dto';

/** Concluídas (RN26): «Terminada» e «Entregue». */
const DONE_STATES: readonly TaskState[] = ['done', 'delivered'];

export interface UserSummary {
  id: string;
  name: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  state: TaskState;
  priority: Priority;
  teamId: string;
  assignee: UserSummary | null;
  estimateHours: number | null;
  storyPoints: number | null;
  isBlocked: boolean;
  isOverdue: boolean;
  subtaskCount: number;
}

export interface Task extends Omit<TaskSummary, 'subtaskCount'> {
  projectId: string;
  epicId: string | null;
  parentTaskId: string | null;
  description: string | null;
  originalTeamId: string;
  dueDate: string | null;
  blockReason: string | null;
  acceptanceCriteria: {
    id: string;
    description: string;
    isMet: boolean;
    metBy: UserSummary | null;
    metAt: string | null;
  }[];
  participants: { user: UserSummary; addedBy: UserSummary; addedAt: string }[];
  subtasks: TaskSummary[];
  createdBy: UserSummary;
  createdAt: string;
}

/** openapi.yaml: TaskTransfer (RN14, RN20, RN22). */
export interface TaskTransfer {
  taskId: string;
  previousTeamId: string;
  newTeamId: string;
  originalTeamId: string;
  transferredSubtaskIds: string[];
  removedFromSprintId: string | null;
  transferredBy: string;
  transferredAt: string;
}

export interface TaskPage {
  page: number;
  pageSize: number;
  total: number;
  items: TaskSummary[];
}

interface SummaryRow {
  id: string;
  title: string;
  state: TaskState;
  priority: Priority;
  team_id: string;
  assignee_id: string | null;
  estimate_hours: string | null;
  story_points: number | null;
  is_blocked: boolean;
  is_overdue: boolean;
  subtask_count: number;
  subtask_hours: string | null;
  subtask_points: number | null;
}

/**
 * Colunas de TaskSummary. RN22: numa tarefa com subtarefas, as estimativas são a soma das das
 * subtarefas não eliminadas. RF28: prazo ultrapassado e tarefa não concluída («Terminada» e
 * «Entregue» contam como concluídas, RN26).
 */
const summaryColumns = () => `
  t.id, t.title, t.state, t.priority, t.team_id, t.assignee_id, t.estimate_hours, t.story_points, t.is_blocked,
  coalesce(t.due_date < ${todaySql()} AND t.state NOT IN ('done', 'delivered'), false) AS is_overdue,
  s.subtask_count, s.subtask_hours, s.subtask_points`;
const SUBTASK_TOTALS = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS subtask_count, sum(st.estimate_hours) AS subtask_hours, sum(st.story_points)::int AS subtask_points
    FROM work.task st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL
  ) s ON true`;

const hours = (value: string | null) => (value === null ? null : Number(value));

/**
 * Tarefas e subtarefas (US02, US03; Ficha PL 03, Ex. 5). A autorização de cada operação é verificada
 * antes pelo guarda global (§3.1); aqui aplicam-se as regras do domínio (RN12, RN22, RN23, RN26, RN38).
 * Cada alteração publica um evento de domínio, registado no histórico na mesma transação (RN32).
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    private readonly organization: OrganizationReader,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(SPRINT_LOCATOR) private readonly sprints: SprintLocator,
  ) {}

  /**
   * CA03.19, D46: tarefas do projeto (sem subtarefas nem eliminadas), filtradas por estado e
   * prioridade; o total é o do conjunto filtrado. Mais recentes primeiro.
   */
  async list(
    projectId: string,
    filters: { state?: TaskState; priority?: Priority },
    page: number,
    pageSize: number,
  ): Promise<TaskPage> {
    const params: unknown[] = [projectId];
    let where = 'o.project_id = $1 AND t.deleted_at IS NULL';
    if (filters.state) {
      params.push(filters.state);
      where += ` AND t.state = $${params.length}::work.task_state`;
    }
    if (filters.priority) {
      params.push(filters.priority);
      where += ` AND t.priority = $${params.length}::work.task_priority`;
    }
    const from = `FROM work.task t JOIN work.epic e ON e.id = t.epic_id JOIN work.objective o ON o.id = e.objective_id`;
    const [{ total }] = await this.db.query(`SELECT count(*)::int AS total ${from} WHERE ${where}`, params);
    const rows: SummaryRow[] = await this.db.query(
      `SELECT ${summaryColumns()} ${from} ${SUBTASK_TOTALS} WHERE ${where}
       ORDER BY t.created_at DESC, t.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { page, pageSize, total, items: await this.toSummaries(rows) };
  }

  /**
   * CA03.1, CA02.3, CA02.4, CA03.11: uma tarefa pertence a um épico do projeto e tem uma equipa
   * associada ao projeto (RN12, RN23, CA03.7); uma subtarefa herda a equipa da tarefa principal
   * (RN22, CA02.8) e não tem subtarefas. O estado inicial é «Em planeamento»; a prioridade, «Média»
   * se omitida. As estimativas são opcionais e independentes (CA03.4, RN27). O criador vem do token.
   */
  async create(user: AuthenticatedUser, projectId: string, dto: CreateTaskDto): Promise<Task> {
    const id = await this.db.transaction(async (tx) => {
      let teamId: string;
      if (dto.parentTaskId) {
        const parent = await this.lockParent(tx, dto.parentTaskId, projectId);
        if (dto.teamId && dto.teamId !== parent.teamId) {
          throw new UnprocessableEntityException('A subtarefa tem sempre a equipa da tarefa principal.');
        }
        teamId = parent.teamId;
      } else {
        const [epic] = await tx.query(
          `SELECT e.id FROM work.epic e JOIN work.objective o ON o.id = e.objective_id
           WHERE e.id = $1 AND o.project_id = $2 FOR SHARE OF e`,
          [dto.epicId, projectId],
        );
        if (!epic) throw new UnprocessableEntityException('O épico não pertence a este projeto.');
        teamId = dto.teamId!;
        if (!(await this.organization.isActiveTeamOfProject(teamId, projectId))) {
          throw new UnprocessableEntityException('A equipa não está associada a este projeto ou foi desativada.');
        }
      }
      const description = dto.description || null;
      const priority = dto.priority ?? 'medium';
      const estimateHours = dto.estimateHours ?? null;
      const storyPoints = dto.storyPoints ?? null;
      const assigneeId = dto.assigneeId ?? null;
      const dueDate = dto.dueDate ?? null;
      const [row] = await tx.query(
        `INSERT INTO work.task (epic_id, parent_task_id, title, description, team_id, original_team_id, priority,
                                estimate_hours, story_points, assignee_id, created_by, due_date)
         VALUES ($1, $2, $3, $4, $5, $5, $6::work.task_priority, $7, $8, $9, $10, $11) RETURNING id`,
        [
          dto.parentTaskId ? null : dto.epicId,
          dto.parentTaskId ?? null,
          dto.title,
          description,
          teamId,
          priority,
          estimateHours,
          storyPoints,
          assigneeId,
          user.id,
          dueDate,
        ],
      );
      await this.events.publish(
        {
          entityType: 'task',
          entityId: row.id,
          eventType: 'created',
          oldValue: null,
          newValue: {
            title: dto.title,
            description,
            priority,
            state: 'in_planning',
            teamId,
            estimateHours,
            storyPoints,
            assigneeId,
            dueDate,
            ...(dto.parentTaskId ? { parentTaskId: dto.parentTaskId } : { epicId: dto.epicId }),
          },
          authorId: user.id,
        },
        tx,
      );
      return row.id as string;
    });
    return this.get(id);
  }

  /** Tarefa com critérios, participantes e subtarefas (openapi.yaml: getTask). */
  async get(taskId: string): Promise<Task> {
    const [row] = await this.db.query(
      `SELECT ${summaryColumns()}, o.project_id, t.epic_id, t.parent_task_id, t.description, t.original_team_id,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.block_reason, t.created_by, t.created_at
       FROM work.task t
       LEFT JOIN work.task p ON p.id = t.parent_task_id
       JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
       JOIN work.objective o ON o.id = e.objective_id
       ${SUBTASK_TOTALS}
       WHERE t.id = $1 AND t.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)`,
      [taskId],
    );
    if (!row) throw new NotFoundException('A tarefa não existe.');

    const criteria: { id: string; description: string; is_met: boolean; met_by: string | null; met_at: Date | null }[] =
      await this.db.query(
        `SELECT id, description, is_met, met_by, met_at FROM work.acceptance_criterion
         WHERE task_id = $1 ORDER BY created_at, id`,
        [taskId],
      );
    const participants: { user_id: string; added_by: string; added_at: Date }[] = await this.db.query(
      `SELECT user_id, added_by, added_at FROM work.task_participant WHERE task_id = $1 ORDER BY added_at, user_id`,
      [taskId],
    );
    const subtaskRows: SummaryRow[] = await this.db.query(
      `SELECT ${summaryColumns()} FROM work.task t ${SUBTASK_TOTALS}
       WHERE t.parent_task_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at, t.id`,
      [taskId],
    );

    const names = await this.users.namesByIds([
      row.created_by,
      ...criteria.flatMap((c) => (c.met_by ? [c.met_by] : [])),
      ...participants.flatMap((p) => [p.user_id, p.added_by]),
    ]);
    const person = (id: string): UserSummary => ({ id, name: names.get(id) ?? '' });
    const [summary] = await this.toSummaries([row]);
    const { subtaskCount: _subtaskCount, ...fields } = summary;

    return {
      ...fields,
      projectId: row.project_id,
      epicId: row.epic_id,
      parentTaskId: row.parent_task_id,
      description: row.description,
      originalTeamId: row.original_team_id,
      dueDate: row.due_date,
      blockReason: row.block_reason,
      acceptanceCriteria: criteria.map((c) => ({
        id: c.id,
        description: c.description,
        isMet: c.is_met,
        metBy: c.met_by ? person(c.met_by) : null,
        metAt: c.met_at ? c.met_at.toISOString() : null,
      })),
      participants: participants.map((p) => ({
        user: person(p.user_id),
        addedBy: person(p.added_by),
        addedAt: p.added_at.toISOString(),
      })),
      subtasks: await this.toSummaries(subtaskRows),
      createdBy: person(row.created_by),
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  /**
   * CA03.12, CA03.18, D49: altera só os campos enviados; a descrição vazia ou `null` fica sem valor.
   * CA03.5: cada estimativa muda sem alterar a outra; a alteração fica no histórico como
   * `estimate_changed` (RN10). RN22: numa tarefa com subtarefas, a estimativa é a soma das das
   * subtarefas e não se define diretamente (422). CA03.3, CA09.1: o responsável pela execução muda sem
   * mudar a equipa responsável (RN20); fica no histórico como `assignee_changed`, com a justificação
   * quando é de outra equipa (RN03, RN15). A elegibilidade foi verificada antes pelo guarda.
   * RN29: o prazo muda com `due_date_changed`. RN28, CA07.6: bloquear exige o motivo; desbloquear apaga-o;
   * o estado mantém-se; `blocked`, `unblocked` ou `block_reason_changed` no histórico.
   */
  async update(user: AuthenticatedUser, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockActive(tx, taskId);
      if (dto.estimateHours !== undefined || dto.storyPoints !== undefined) {
        const [{ n }] = await tx.query(
          `SELECT count(*)::int AS n FROM work.task WHERE parent_task_id = $1 AND deleted_at IS NULL`,
          [taskId],
        );
        if (n > 0) {
          throw new UnprocessableEntityException(
            'A estimativa de uma tarefa com subtarefas é a soma das estimativas das subtarefas (RN22): altere as das subtarefas.',
          );
        }
      }
      const next = {
        title: dto.title ?? current.title,
        description: dto.description === undefined ? current.description : dto.description || null,
        priority: dto.priority ?? current.priority,
        estimateHours: dto.estimateHours === undefined ? current.estimateHours : dto.estimateHours,
        storyPoints: dto.storyPoints === undefined ? current.storyPoints : dto.storyPoints,
        assigneeId: dto.assigneeId === undefined ? current.assigneeId : dto.assigneeId,
        dueDate: dto.dueDate === undefined ? current.dueDate : dto.dueDate,
      };
      const isBlocked = dto.isBlocked ?? current.isBlocked;
      let blockReason = dto.blockReason === undefined ? current.blockReason : dto.blockReason?.trim() || null;
      if (!isBlocked) {
        if (dto.blockReason !== undefined && blockReason !== null) {
          throw new UnprocessableEntityException('O motivo do bloqueio só se indica com a tarefa bloqueada (RN28).');
        }
        blockReason = null;
      } else if (!blockReason) {
        throw new UnprocessableEntityException('Indique o motivo do bloqueio: descreva o impedimento ao trabalho (RN28).');
      }
      const diff = (keys: readonly (keyof typeof next)[]) => {
        const oldValue: Record<string, unknown> = {};
        const newValue: Record<string, unknown> = {};
        for (const key of keys) {
          if (next[key] !== current[key]) {
            oldValue[key] = current[key];
            newValue[key] = next[key];
          }
        }
        return Object.keys(newValue).length > 0 ? { oldValue, newValue } : null;
      };
      const fields = diff(['title', 'description', 'priority']);
      const estimates = diff(['estimateHours', 'storyPoints']);
      const assignee = diff(['assigneeId']);
      const due = diff(['dueDate']);
      const blockChanged = isBlocked !== current.isBlocked || blockReason !== current.blockReason;
      if (!fields && !estimates && !assignee && !due && !blockChanged) return;
      await tx.query(
        `UPDATE work.task SET title = $2, description = $3, priority = $4::work.task_priority,
                              estimate_hours = $5, story_points = $6, assignee_id = $7, due_date = $8,
                              is_blocked = $9, block_reason = $10
         WHERE id = $1`,
        [
          taskId,
          next.title,
          next.description,
          next.priority,
          next.estimateHours,
          next.storyPoints,
          next.assigneeId,
          next.dueDate,
          isBlocked,
          blockReason,
        ],
      );
      if (due) {
        await this.events.publish({ entityType: 'task', entityId: taskId, eventType: 'due_date_changed', ...due, authorId: user.id }, tx);
      }
      if (blockChanged) {
        const eventType = isBlocked && !current.isBlocked ? 'blocked' : !isBlocked ? 'unblocked' : 'block_reason_changed';
        await this.events.publish(
          {
            entityType: 'task',
            entityId: taskId,
            eventType,
            oldValue: { isBlocked: current.isBlocked, blockReason: current.blockReason },
            newValue: { isBlocked, blockReason },
            authorId: user.id,
          },
          tx,
        );
      }
      if (fields) {
        await this.events.publish({ entityType: 'task', entityId: taskId, eventType: 'updated', ...fields, authorId: user.id }, tx);
      }
      if (estimates) {
        await this.events.publish(
          { entityType: 'task', entityId: taskId, eventType: 'estimate_changed', ...estimates, authorId: user.id },
          tx,
        );
      }
      if (assignee) {
        const crossTeam =
          next.assigneeId !== null && !(await this.organization.teamRole(next.assigneeId, current.teamId));
        await this.events.publish(
          {
            entityType: 'task',
            entityId: taskId,
            eventType: 'assignee_changed',
            oldValue: assignee.oldValue,
            newValue: {
              ...assignee.newValue,
              ...(crossTeam ? { crossTeam: true, justification: dto.assignmentJustification } : {}),
            },
            authorId: user.id,
          },
          tx,
        );
      }
    });
    return this.get(taskId);
  }

  /** RN26, RN27, RN13: muda o estado se a transição for válida; senão 409 e a tarefa mantém-se. */
  async changeState(user: AuthenticatedUser, taskId: string, target: TaskState): Promise<Task> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockActive(tx, taskId);
      const [criteria] = await tx.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_met)::int AS met
         FROM work.acceptance_criterion WHERE task_id = $1`,
        [taskId],
      );
      const transition = checkTransition(current.state, target, criteria);
      if (!transition.allowed) throw new ConflictException(transition.reason);
      await tx.query(`UPDATE work.task SET state = $2::work.task_state WHERE id = $1`, [taskId, target]);
      await this.events.publish(
        {
          entityType: 'task',
          entityId: taskId,
          eventType: transition.kind === 'reopen' ? 'reopened' : 'state_changed',
          oldValue: { state: current.state },
          newValue: { state: target },
          authorId: user.id,
        },
        tx,
      );
    });
    return this.get(taskId);
  }

  /**
   * CA03.17, RN38: eliminação lógica da tarefa e das suas subtarefas, que deixam de constar das
   * listagens e contagens; nada é apagado fisicamente e o histórico regista cada eliminação.
   */
  async delete(user: AuthenticatedUser, taskId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockActive(tx, taskId);
      // Com o PostgreSQL, um UPDATE devolve [linhas de RETURNING, número de linhas afetadas].
      const [subtasks]: [{ id: string; title: string }[], number] = await tx.query(
        `UPDATE work.task SET deleted_at = now() WHERE parent_task_id = $1 AND deleted_at IS NULL RETURNING id, title`,
        [taskId],
      );
      await tx.query(`UPDATE work.task SET deleted_at = now() WHERE id = $1`, [taskId]);
      for (const deleted of [{ id: taskId, title: current.title }, ...subtasks]) {
        await this.events.publish(
          {
            entityType: 'task',
            entityId: deleted.id,
            eventType: 'deleted',
            oldValue: { title: deleted.title },
            newValue: null,
            authorId: user.id,
          },
          tx,
        );
      }
    });
  }

  private async toSummaries(rows: SummaryRow[]): Promise<TaskSummary[]> {
    const names = await this.users.namesByIds(rows.flatMap((r) => (r.assignee_id ? [r.assignee_id] : [])));
    return rows.map((r) => {
      const hasSubtasks = r.subtask_count > 0;
      return {
        id: r.id,
        title: r.title,
        state: r.state,
        priority: r.priority,
        teamId: r.team_id,
        assignee: r.assignee_id ? { id: r.assignee_id, name: names.get(r.assignee_id) ?? '' } : null,
        estimateHours: hours(hasSubtasks ? r.subtask_hours : r.estimate_hours),
        storyPoints: hasSubtasks ? r.subtask_points : r.story_points,
        isBlocked: r.is_blocked,
        isOverdue: r.is_overdue,
        subtaskCount: r.subtask_count,
      };
    });
  }

  /** Tarefa principal de uma nova subtarefa: não eliminada, do mesmo projeto e sem tarefa principal (RN12). */
  private async lockParent(tx: EntityManager, parentTaskId: string, projectId: string): Promise<{ teamId: string }> {
    const [parent] = await tx.query(
      `SELECT t.team_id, t.parent_task_id, o.project_id
       FROM work.task t JOIN work.epic e ON e.id = t.epic_id JOIN work.objective o ON o.id = e.objective_id
       WHERE t.id = $1 AND t.deleted_at IS NULL FOR SHARE OF t`,
      [parentTaskId],
    );
    const [subtask] = parent
      ? []
      : await tx.query(`SELECT 1 FROM work.task WHERE id = $1 AND parent_task_id IS NOT NULL AND deleted_at IS NULL`, [
          parentTaskId,
        ]);
    if (subtask) throw new UnprocessableEntityException('Uma subtarefa não pode ter subtarefas.');
    if (!parent || parent.project_id !== projectId) {
      throw new UnprocessableEntityException('A tarefa principal não existe neste projeto.');
    }
    return { teamId: parent.team_id };
  }

  /**
   * RN20, CA09.3, CA09.5, CA09.7, CA09.8 (I12): muda a equipa responsável da tarefa e das suas subtarefas
   * (RN22), numa só transação. Recusa (409) a subtarefa isolada, a tarefa concluída e a mesma equipa; a
   * equipa de destino tem de estar ativa e associada ao projeto (422; RN23, RN33). A equipa original não
   * muda (RN14). O responsável mantém-se se for membro da equipa de destino; senão a atribuição é retirada
   * e fica no histórico (RN15, decisão 1a, F22). As subtarefas concluídas mudam de equipa mas ficam na
   * sprint em que foram feitas; as restantes saem da sprint em aberto (RN20, decisão 2a, F22). Cada
   * tarefa fica com `team_transferred` no histórico, com a equipa anterior, a nova, a original e o
   * responsável (RN32, CA09.2, CA06.6).
   */
  async transfer(user: AuthenticatedUser, taskId: string, targetTeamId: string): Promise<TaskTransfer> {
    return this.db.transaction(async (tx) => {
      const [task] = await tx.query(
        `SELECT t.id, t.parent_task_id, t.state, t.team_id, t.original_team_id, t.assignee_id, o.project_id
         FROM work.task t
         LEFT JOIN work.task p ON p.id = t.parent_task_id
         JOIN work.epic e ON e.id = coalesce(t.epic_id, p.epic_id)
         JOIN work.objective o ON o.id = e.objective_id
         WHERE t.id = $1 AND t.deleted_at IS NULL FOR UPDATE OF t`,
        [taskId],
      );
      if (!task) throw new NotFoundException('A tarefa não existe.');
      if (task.parent_task_id) {
        throw new ConflictException('Só se transferem tarefas: a subtarefa acompanha a tarefa principal (RN22).');
      }
      if (DONE_STATES.includes(task.state)) {
        throw new ConflictException('Uma tarefa em «Terminada» ou «Entregue» não pode ser transferida.');
      }
      if (task.team_id === targetTeamId) throw new ConflictException('A tarefa já pertence a esta equipa.');
      if (!(await this.organization.isActiveTeamOfProject(targetTeamId, task.project_id))) {
        throw new UnprocessableEntityException('A equipa de destino não está associada a este projeto ou foi desativada.');
      }
      const subtasks: { id: string; state: TaskState; team_id: string; original_team_id: string; assignee_id: string | null }[] =
        await tx.query(
          `SELECT id, state, team_id, original_team_id, assignee_id FROM work.task
           WHERE parent_task_id = $1 AND deleted_at IS NULL ORDER BY id FOR UPDATE`,
          [taskId],
        );
      const [{ at }] = await tx.query(`SELECT now() AS at`);
      for (const item of [task, ...subtasks]) {
        const keeps = item.assignee_id !== null && (await this.organization.teamRole(item.assignee_id, targetTeamId)) !== null;
        const assigneeId = keeps ? item.assignee_id : null;
        await tx.query(`UPDATE work.task SET team_id = $2, assignee_id = $3 WHERE id = $1`, [item.id, targetTeamId, assigneeId]);
        await this.events.publish(
          {
            entityType: 'task',
            entityId: item.id,
            eventType: 'team_transferred',
            oldValue: { teamId: item.team_id, assigneeId: item.assignee_id },
            newValue: {
              teamId: targetTeamId,
              originalTeamId: item.original_team_id,
              assigneeId,
              ...(item.id === taskId ? {} : { withParentTaskId: taskId }),
            },
            authorId: user.id,
          },
          tx,
        );
        if (item.assignee_id !== assigneeId) {
          await this.events.publish(
            {
              entityType: 'task',
              entityId: item.id,
              eventType: 'assignee_changed',
              oldValue: { assigneeId: item.assignee_id },
              newValue: { assigneeId: null, reason: 'transferred' },
              authorId: user.id,
            },
            tx,
          );
        }
      }
      const open = [task, ...subtasks].filter((x) => !DONE_STATES.includes(x.state)).map((x) => x.id as string);
      const released = await this.sprints.releaseTransferredTasks(open, user.id, tx);
      return {
        taskId,
        previousTeamId: task.team_id,
        newTeamId: targetTeamId,
        originalTeamId: task.original_team_id,
        transferredSubtaskIds: subtasks.map((s) => s.id),
        removedFromSprintId: released.get(taskId) ?? null,
        transferredBy: user.id,
        transferredAt: (at as Date).toISOString(),
      };
    });
  }

  /** Bloqueia a linha da tarefa não eliminada durante a transação; senão 404 (RN38). */
  private async lockActive(
    tx: EntityManager,
    taskId: string,
  ): Promise<{
    title: string;
    description: string | null;
    priority: Priority;
    state: TaskState;
    estimateHours: number | null;
    storyPoints: number | null;
    assigneeId: string | null;
    teamId: string;
    dueDate: string | null;
    isBlocked: boolean;
    blockReason: string | null;
  }> {
    const [row] = await tx.query(
      `SELECT title, description, priority, state, estimate_hours, story_points, assignee_id, team_id,
              to_char(due_date, 'YYYY-MM-DD') AS due_date, is_blocked, block_reason
       FROM work.task WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [taskId],
    );
    if (!row) throw new NotFoundException('A tarefa não existe.');
    const { estimate_hours, story_points, assignee_id, team_id, due_date, is_blocked, block_reason, ...rest } = row;
    return {
      ...rest,
      estimateHours: hours(estimate_hours),
      storyPoints: story_points,
      assigneeId: assignee_id,
      teamId: team_id,
      dueDate: due_date,
      isBlocked: is_blocked,
      blockReason: block_reason,
    };
  }
}
