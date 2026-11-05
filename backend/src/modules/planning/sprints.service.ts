import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { DONE_STATES, WORK_ITEM_LOCATOR, type PlanningTaskInfo, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';
import { planningTimeZone, workingDays } from './sprint-calendar';

export type SprintStatus = 'planned' | 'active' | 'closed';
/** Quem consulta uma vista de planeamento (CAT06). */
type Viewer = { id: string; isAdmin: boolean };
export type LeftReason = 'sprint_ended' | 'removed' | 'transferred';

export interface Sprint {
  id: string;
  teamId: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: SprintStatus;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface PlanningTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  parentTaskId: string | null;
  state: PlanningTaskInfo['state'];
  priority: PlanningTaskInfo['priority'];
  estimateHours: number | null;
  storyPoints: number | null;
  assignee: { id: string; name: string } | null;
  plannable: boolean;
}

export interface SprintTask extends PlanningTask {
  plannedAt: string;
  addedAfterStart: boolean;
  startEstimateHours: number | null;
  startStoryPoints: number | null;
  leftAt: string | null;
  leftReason: LeftReason | null;
}

export interface SprintDetail extends Sprint {
  tasks: SprintTask[];
  leftTasks: SprintTask[];
}

export interface WorkTotals {
  startHours: number | null;
  currentHours: number;
  startStoryPoints: number | null;
  currentStoryPoints: number;
  tasks: number;
}

export interface SprintProgress {
  sprintId: string;
  status: SprintStatus;
  planned: WorkTotals;
  done: WorkTotals;
  tasks: {
    id: string;
    title: string;
    state: PlanningTaskInfo['state'];
    startEstimateHours: number | null;
    currentEstimateHours: number | null;
    startStoryPoints: number | null;
    currentStoryPoints: number | null;
    addedAfterStart: boolean;
    leftReason: LeftReason | null;
    done: boolean;
  }[];
}

export interface BacklogPage {
  page: number;
  pageSize: number;
  total: number;
  items: (PlanningTask & { plannedSprintId: string | null })[];
}

interface SprintRow {
  id: string;
  team_id: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  started_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
}

interface SprintTaskRow {
  task_id: string;
  planned_at: Date;
  added_after_start: boolean;
  start_estimate_hours: string | null;
  start_story_points: number | null;
  left_at: Date | null;
  left_reason: LeftReason | null;
}

const SPRINT_COLUMNS = `id, team_id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
  status, started_at, closed_at, created_at`;
const num = (v: string | null) => (v === null ? null : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

const toSprint = (r: SprintRow): Sprint => ({
  id: r.id,
  teamId: r.team_id,
  startDate: r.start_date,
  endDate: r.end_date,
  workingDays: workingDays(r.start_date, r.end_date),
  status: r.status,
  startedAt: r.started_at ? r.started_at.toISOString() : null,
  closedAt: r.closed_at ? r.closed_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
});

/**
 * Sprints e backlog de cada equipa (US04, US08; RN04, RN05, RN08, RN10, RN27, RN31, RN36, RN37). A
 * autorização é verificada antes pelo guarda global (§3.1). As tarefas são do módulo Trabalho (interface
 * WorkItemLocator), as equipas e os projetos do módulo Organização e os nomes do módulo Identidade:
 * nenhum é lido diretamente (architecture.md §6). As operações de planeamento de uma equipa ficam
 * serializadas por um trinco da transação (sem sobreposições nem tarefas em duas sprints em aberto), e
 * cada alteração fica no histórico da sprint, na mesma transação (RN32).
 */
@Injectable()
export class SprintsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async list(teamId: string): Promise<Sprint[]> {
    const rows: SprintRow[] = await this.db.query(
      `SELECT ${SPRINT_COLUMNS} FROM planning.sprint WHERE team_id = $1 ORDER BY start_date DESC, id`,
      [teamId],
    );
    return rows.map(toSprint);
  }

  /** CA04.1, CA04.8, RN31, RN36: «Planeada», sem sobreposição com outra sprint da equipa. */
  async create(user: AuthenticatedUser, teamId: string, startDate: string, endDate: string): Promise<SprintDetail> {
    const id = await this.db.transaction(async (tx) => {
      await this.lockTeam(tx, teamId);
      if (!(await this.organization.teamStatus(teamId))?.active) {
        throw new UnprocessableEntityException('A equipa está desativada e não recebe sprints (RN33).');
      }
      await this.requireNoOverlap(tx, teamId, startDate, endDate);
      const [row] = await tx.query(
        `INSERT INTO planning.sprint (team_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING id`,
        [teamId, startDate, endDate],
      );
      await this.publish(tx, user.id, row.id, 'created', null, { teamId, startDate, endDate, status: 'planned' });
      return row.id as string;
    });
    return this.get(id);
  }

  /** CA04.12, CA04.13, RN36: só enquanto «Planeada». */
  async updateDates(user: AuthenticatedUser, sprintId: string, startDate: string, endDate: string): Promise<SprintDetail> {
    await this.db.transaction(async (tx) => {
      const sprint = await this.lockSprint(tx, sprintId);
      if (sprint.status !== 'planned') {
        throw new ConflictException('Só se alteram as datas de uma sprint «Planeada»; depois do início, as datas mantêm-se (RN36).');
      }
      if (sprint.start_date === startDate && sprint.end_date === endDate) return;
      await this.requireNoOverlap(tx, sprint.team_id, startDate, endDate, sprintId);
      await tx.query(`UPDATE planning.sprint SET start_date = $2, end_date = $3 WHERE id = $1`, [sprintId, startDate, endDate]);
      await this.publish(tx, user.id, sprintId, 'dates_changed', { startDate: sprint.start_date, endDate: sprint.end_date }, { startDate, endDate });
    });
    return this.get(sprintId);
  }

  /**
   * CA04.5, CA04.9, CA04.11, RN05, RN10, RN36: inicia uma sprint «Planeada» se a equipa não tiver outra
   * ativa, confirmando ou ajustando as datas; as tarefas planeadas passam a fazer parte dela, com as
   * estimativas desse momento guardadas para comparação.
   */
  async start(user: AuthenticatedUser, sprintId: string, dates: { startDate?: string; endDate?: string }): Promise<SprintDetail> {
    await this.db.transaction(async (tx) => {
      const sprint = await this.lockSprint(tx, sprintId);
      if (sprint.status !== 'planned') throw new ConflictException('Só se inicia uma sprint «Planeada».');
      const [active] = await tx.query(`SELECT 1 FROM planning.sprint WHERE team_id = $1 AND status = 'active'`, [sprint.team_id]);
      if (active) throw new ConflictException('A equipa já tem uma sprint ativa: só pode haver uma de cada vez (RN31).');
      const startDate = dates.startDate ?? sprint.start_date;
      const endDate = dates.endDate ?? sprint.end_date;
      if (startDate > endDate) throw new UnprocessableEntityException('A data de início tem de ser igual ou anterior à de fim (RN31).');
      if (endDate < (await this.today(tx))) {
        throw new UnprocessableEntityException('A data de fim já passou: ajuste as datas para iniciar a sprint.');
      }
      if (startDate !== sprint.start_date || endDate !== sprint.end_date) {
        await this.requireNoOverlap(tx, sprint.team_id, startDate, endDate, sprintId);
      }
      await tx.query(
        `UPDATE planning.sprint SET status = 'active', started_at = now(), start_date = $2, end_date = $3 WHERE id = $1`,
        [sprintId, startDate, endDate],
      );
      const planned: { task_id: string }[] = await tx.query(`SELECT task_id FROM planning.sprint_task WHERE sprint_id = $1`, [sprintId]);
      const infos = await this.work.planningTasks({ taskIds: planned.map((p) => p.task_id) });
      for (const t of infos) {
        await tx.query(
          `UPDATE planning.sprint_task SET start_estimate_hours = $3, start_story_points = $4 WHERE sprint_id = $1 AND task_id = $2`,
          [sprintId, t.id, t.estimateHours, t.storyPoints],
        );
      }
      await this.publish(
        tx,
        user.id,
        sprintId,
        'started',
        { status: 'planned', startDate: sprint.start_date, endDate: sprint.end_date },
        { status: 'active', startDate, endDate, taskIds: planned.map((p) => p.task_id) },
      );
    });
    return this.get(sprintId);
  }

  /**
   * CA04.3, CA04.7, CA04.16, RN27, RN37: planeia a tarefa numa sprint «Planeada», ou acrescenta-a a uma
   * «Ativa» (identificada como acrescentada depois do início, com a estimativa desse momento).
   */
  async planTask(user: AuthenticatedUser, sprintId: string, taskId: string): Promise<SprintDetail> {
    await this.db.transaction(async (tx) => {
      // RN01, RN20 (revisão do I14): a tarefa fica bloqueada até ao fim; uma transferência em curso termina antes
      // e a equipa lida a seguir já é a nova (ou a transferência espera e retira a tarefa desta sprint).
      // Primeiro a tarefa, depois a sprint — a mesma ordem da transferência, para não haver deadlock (CR1).
      await this.work.lockTasks([taskId], tx);
      const sprint = await this.lockSprint(tx, sprintId);
      if (sprint.status === 'closed') throw new ConflictException('A sprint já terminou: não recebe tarefas.');
      const [task] = await this.work.planningTasks({ taskIds: [taskId] }, tx);
      const project = task ? await this.organization.projectNames([task.projectId], tx) : new Map<string, string>();
      if (!task || !project.has(task.projectId)) throw new UnprocessableEntityException('A tarefa não existe ou foi eliminada.');
      if (task.teamId !== sprint.team_id) {
        throw new UnprocessableEntityException('Só se planeiam tarefas do backlog da equipa da sprint (RN01).');
      }
      if (DONE_STATES.includes(task.state)) throw new UnprocessableEntityException('A tarefa já está concluída: não se planeia numa sprint.');
      if (task.estimateHours === null) {
        throw new UnprocessableEntityException('Para planear a tarefa numa sprint, indique primeiro a estimativa temporal (RN27).');
      }
      const [open] = await tx.query(
        `SELECT s.id FROM planning.sprint_task st JOIN planning.sprint s ON s.id = st.sprint_id
         WHERE st.task_id = $1 AND st.left_at IS NULL AND s.status IN ('planned', 'active')`,
        [taskId],
      );
      if (open) {
        throw new ConflictException(
          open.id === sprintId ? 'A tarefa já está nesta sprint.' : 'A tarefa já está planeada noutra sprint em aberto: retire-a primeiro.',
        );
      }
      const active = sprint.status === 'active';
      // Uma tarefa retirada desta sprint ativa que volta: a mesma linha volta a contar, com a estimativa e
      // a indicação de origem que já tinha (continua a contar como planeada no início, RF27).
      const [, reactivated]: [unknown[], number] = await tx.query(
        `UPDATE planning.sprint_task SET left_at = NULL, left_reason = NULL WHERE sprint_id = $1 AND task_id = $2`,
        [sprintId, taskId],
      );
      if (reactivated === 0) {
        await tx.query(
          `INSERT INTO planning.sprint_task (sprint_id, task_id, added_after_start, start_estimate_hours, start_story_points)
           VALUES ($1, $2, $3, $4, $5)`,
          [sprintId, taskId, active, active ? task.estimateHours : null, active ? task.storyPoints : null],
        );
      }
      await this.publish(tx, user.id, sprintId, active ? 'task_added' : 'task_planned', null, {
        taskId,
        estimateHours: task.estimateHours,
        storyPoints: task.storyPoints,
      });
    });
    return this.get(sprintId);
  }

  /**
   * CA04.14, CA04.15, RN37: numa sprint «Planeada», a tarefa deixa de estar planeada; numa «Ativa», volta
   * ao backlog e continua a contar como planeada no início (fica com `left_at`, motivo `removed`).
   */
  async removeTask(user: AuthenticatedUser, sprintId: string, taskId: string): Promise<SprintDetail> {
    await this.db.transaction(async (tx) => {
      const sprint = await this.lockSprint(tx, sprintId);
      if (sprint.status === 'closed') throw new ConflictException('A sprint já terminou: as tarefas mantêm-se como ficaram.');
      const [row] = await tx.query(
        `SELECT 1 FROM planning.sprint_task WHERE sprint_id = $1 AND task_id = $2 AND left_at IS NULL`,
        [sprintId, taskId],
      );
      if (!row) throw new NotFoundException('A tarefa não está nesta sprint.');
      if (sprint.status === 'planned') {
        await tx.query(`DELETE FROM planning.sprint_task WHERE sprint_id = $1 AND task_id = $2`, [sprintId, taskId]);
      } else {
        await tx.query(
          `UPDATE planning.sprint_task SET left_at = now(), left_reason = 'removed' WHERE sprint_id = $1 AND task_id = $2`,
          [sprintId, taskId],
        );
      }
      await this.publish(tx, user.id, sprintId, 'task_removed', { taskId }, { taskId, sprintStatus: sprint.status });
    });
    return this.get(sprintId);
  }

  /**
   * RN20, CA09.8, EC09.3 (I12): as tarefas transferidas saem da sprint em aberto em que estão, na transação
   * da transferência. Numa sprint «Planeada» a ligação desaparece; numa «Ativa» fica com a saída
   * (`transferred`) e continua a contar como planeada no início (RF27). O módulo Trabalho só envia as
   * tarefas não concluídas (decisão 2a, F22). Fica `task_removed` no histórico da sprint.
   */
  async releaseTransferred(taskIds: string[], authorId: string, tx: EntityManager): Promise<Map<string, string>> {
    const released = new Map<string, string>();
    if (taskIds.length === 0) return released;
    const links: { sprint_id: string; task_id: string; status: SprintStatus }[] = await tx.query(
      `SELECT st.sprint_id, st.task_id, s.status FROM planning.sprint_task st JOIN planning.sprint s ON s.id = st.sprint_id
       WHERE st.task_id = ANY($1) AND st.left_at IS NULL AND s.status <> 'closed'
       ORDER BY st.sprint_id, st.task_id FOR UPDATE OF s, st`,
      [taskIds],
    );
    for (const l of links) {
      if (l.status === 'planned') {
        await tx.query(`DELETE FROM planning.sprint_task WHERE sprint_id = $1 AND task_id = $2`, [l.sprint_id, l.task_id]);
      } else {
        await tx.query(
          `UPDATE planning.sprint_task SET left_at = now(), left_reason = 'transferred' WHERE sprint_id = $1 AND task_id = $2`,
          [l.sprint_id, l.task_id],
        );
      }
      await this.publish(tx, authorId, l.sprint_id, 'task_removed', { taskId: l.task_id }, { taskId: l.task_id, sprintStatus: l.status, reason: 'transferred' });
      released.set(l.task_id, l.sprint_id);
    }
    return released;
  }

  /** `viewer`: quem consulta; o gestor que não é da equipa vê só as tarefas dos seus projetos (CAT06, decisão 2a). */
  async get(sprintId: string, viewer?: Viewer): Promise<SprintDetail> {
    const [row]: SprintRow[] = await this.db.query(`SELECT ${SPRINT_COLUMNS} FROM planning.sprint WHERE id = $1`, [sprintId]);
    if (!row) throw new NotFoundException('A sprint não existe.');
    const links: SprintTaskRow[] = await this.db.query(
      `SELECT task_id, planned_at, added_after_start, start_estimate_hours, start_story_points, left_at, left_reason
       FROM planning.sprint_task WHERE sprint_id = $1 ORDER BY planned_at, task_id`,
      [sprintId],
    );
    const tasks = await this.describe(
      await this.scoped(await this.work.planningTasks({ taskIds: links.map((l) => l.task_id) }), viewer, row.team_id),
    );
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const items: SprintTask[] = links.flatMap((l) => {
      const t = byId.get(l.task_id);
      if (!t) return [];
      return [
        {
          ...t,
          plannedAt: l.planned_at.toISOString(),
          addedAfterStart: l.added_after_start,
          startEstimateHours: num(l.start_estimate_hours),
          startStoryPoints: l.start_story_points,
          leftAt: l.left_at ? l.left_at.toISOString() : null,
          leftReason: l.left_reason,
        },
      ];
    });
    return { ...toSprint(row), tasks: items.filter((i) => !i.leftAt), leftTasks: items.filter((i) => i.leftAt) };
  }

  /**
   * CA04.2, CA04.3: tarefas da equipa que não fazem parte da sprint ativa, de todos os projetos; as
   * planeadas numa sprint «Planeada» ficam assinaladas. Mais recentes primeiro, com o total (D46).
   */
  async backlog(teamId: string, page: number, pageSize: number, viewer?: Viewer): Promise<BacklogPage> {
    const links: { task_id: string; sprint_id: string; status: SprintStatus }[] = await this.db.query(
      `SELECT st.task_id, st.sprint_id, s.status FROM planning.sprint_task st JOIN planning.sprint s ON s.id = st.sprint_id
       WHERE s.team_id = $1 AND st.left_at IS NULL AND s.status IN ('planned', 'active')`,
      [teamId],
    );
    const inActive = new Set(links.filter((l) => l.status === 'active').map((l) => l.task_id));
    const plannedIn = new Map(links.filter((l) => l.status === 'planned').map((l) => [l.task_id, l.sprint_id]));
    const all = (await this.describe(await this.scoped(await this.work.planningTasks({ teamId }), viewer, teamId))).filter(
      (t) => !inActive.has(t.id),
    );
    return {
      page,
      pageSize,
      total: all.length,
      items: all.slice((page - 1) * pageSize, page * pageSize).map((t) => ({ ...t, plannedSprintId: plannedIn.get(t.id) ?? null })),
    };
  }

  /**
   * RN04, RN36, CA04.4: termina as sprints ativas cuja data de fim já passou no fuso do planeamento; as
   * tarefas não concluídas voltam ao backlog (mantendo tudo o resto); as concluídas ficam associadas à
   * sprint. Idempotente. Chamado pela tarefa diária; `today` só é indicado nos testes.
   */
  async closeEndedSprints(authorId: string, today?: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const day = today ?? (await this.today(tx));
      const due: SprintRow[] = await tx.query(
        `SELECT ${SPRINT_COLUMNS} FROM planning.sprint WHERE status = 'active' AND end_date < $1::date ORDER BY id FOR UPDATE`,
        [day],
      );
      for (const sprint of due) {
        const open: { task_id: string }[] = await tx.query(
          `SELECT task_id FROM planning.sprint_task WHERE sprint_id = $1 AND left_at IS NULL`,
          [sprint.id],
        );
        const infos = await this.work.planningTasks({ taskIds: open.map((o) => o.task_id) });
        const unfinished = infos.filter((t) => !DONE_STATES.includes(t.state)).map((t) => t.id);
        if (unfinished.length > 0) {
          await tx.query(
            `UPDATE planning.sprint_task SET left_at = now(), left_reason = 'sprint_ended'
             WHERE sprint_id = $1 AND task_id = ANY($2::uuid[]) AND left_at IS NULL`,
            [sprint.id, unfinished],
          );
        }
        await tx.query(`UPDATE planning.sprint SET status = 'closed', closed_at = now() WHERE id = $1`, [sprint.id]);
        await this.publish(tx, authorId, sprint.id, 'closed', { status: 'active' }, { status: 'closed', returnedToBacklog: unfinished });
      }
      return due.map((s) => s.id);
    });
  }

  /**
   * CA07.2, RF27, RN10, RN37: planeado = todas as tarefas que entraram na sprint, incluindo as retiradas
   * depois do início e as que saíram no fim; concluído = as que continuam na sprint em «Terminada» ou
   * «Entregue». Horas e story points em separado, com a estimativa do início (ou de quando foi acrescentada)
   * e a atual. Uma tarefa com subtarefas conta 0, como na capacidade (RN22).
   */
  async progress(sprintId: string, viewer?: Viewer): Promise<SprintProgress> {
    const [sprint] = await this.db.query(`SELECT status, team_id FROM planning.sprint WHERE id = $1`, [sprintId]);
    if (!sprint) throw new NotFoundException('A sprint não existe.');
    const links: SprintTaskRow[] = await this.db.query(
      `SELECT task_id, planned_at, added_after_start, start_estimate_hours, start_story_points, left_at, left_reason
       FROM planning.sprint_task WHERE sprint_id = $1 ORDER BY planned_at, task_id`,
      [sprintId],
    );
    const infos = await this.scoped(await this.work.planningTasks({ taskIds: links.map((l) => l.task_id) }), viewer, sprint.team_id);
    const projects = await this.organization.projectNames([...new Set(infos.map((t) => t.projectId))]);
    const byId = new Map(infos.filter((t) => projects.has(t.projectId)).map((t) => [t.id, t]));
    const started = sprint.status !== 'planned';
    const tasks = links.flatMap((l) => {
      const t = byId.get(l.task_id);
      if (!t) return [];
      const zero = t.hasSubtasks;
      return [
        {
          id: t.id,
          title: t.title,
          state: t.state,
          startEstimateHours: started ? (zero ? 0 : num(l.start_estimate_hours)) : null,
          currentEstimateHours: zero ? 0 : t.estimateHours,
          startStoryPoints: started ? (zero ? 0 : l.start_story_points) : null,
          currentStoryPoints: zero ? 0 : t.storyPoints,
          addedAfterStart: l.added_after_start,
          leftReason: l.left_reason,
          done: !l.left_at && DONE_STATES.includes(t.state),
        },
      ];
    });
    const totals = (list: typeof tasks) => ({
      startHours: started ? round2(list.reduce((sum, t) => sum + (t.startEstimateHours ?? 0), 0)) : null,
      currentHours: round2(list.reduce((sum, t) => sum + (t.currentEstimateHours ?? 0), 0)),
      startStoryPoints: started ? list.reduce((sum, t) => sum + (t.startStoryPoints ?? 0), 0) : null,
      currentStoryPoints: list.reduce((sum, t) => sum + (t.currentStoryPoints ?? 0), 0),
      tasks: list.length,
    });
    return { sprintId, status: sprint.status, planned: totals(tasks), done: totals(tasks.filter((t) => t.done)), tasks };
  }

  /** CAT06, decisão 2a (I14): só as tarefas dos projetos que quem consulta vê, quando não é da equipa. */
  private async scoped<T extends { projectId: string }>(items: T[], viewer: Viewer | undefined, teamId: string): Promise<T[]> {
    const scope = viewer ? await this.organization.projectScope(viewer, teamId) : null;
    return scope ? items.filter((t) => scope.has(t.projectId)) : items;
  }

  /** Nomes dos projetos e dos responsáveis; sem as tarefas de projetos eliminados (RN38). */
  private async describe(infos: PlanningTaskInfo[]): Promise<PlanningTask[]> {
    const [projects, people] = await Promise.all([
      this.organization.projectNames([...new Set(infos.map((t) => t.projectId))]),
      this.users.namesByIds(infos.flatMap((t) => (t.assigneeId ? [t.assigneeId] : []))),
    ]);
    return infos
      .filter((t) => projects.has(t.projectId))
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: projects.get(t.projectId)!,
        parentTaskId: t.parentTaskId,
        state: t.state,
        priority: t.priority,
        estimateHours: t.estimateHours,
        storyPoints: t.storyPoints,
        assignee: t.assigneeId ? { id: t.assigneeId, name: people.get(t.assigneeId) ?? '' } : null,
        plannable: !DONE_STATES.includes(t.state) && t.estimateHours !== null,
      }));
  }

  /** RN31: sem sobreposição com nenhuma outra sprint da equipa, em qualquer estado (409). */
  private async requireNoOverlap(tx: EntityManager, teamId: string, startDate: string, endDate: string, exceptId?: string) {
    const [clash] = await tx.query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS s, to_char(end_date, 'YYYY-MM-DD') AS e FROM planning.sprint
       WHERE team_id = $1 AND start_date <= $3::date AND end_date >= $2::date AND ($4::uuid IS NULL OR id <> $4::uuid) LIMIT 1`,
      [teamId, startDate, endDate, exceptId ?? null],
    );
    if (clash) throw new ConflictException(`As datas sobrepõem-se à sprint de ${clash.s} a ${clash.e} da mesma equipa (RN31).`);
  }

  /** Serializa as operações de planeamento de uma equipa até ao fim da transação. */
  private async lockTeam(tx: EntityManager, teamId: string) {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext('planning:' || $1::text))`, [teamId]);
  }

  private async lockSprint(tx: EntityManager, sprintId: string): Promise<SprintRow> {
    const [found] = await tx.query(`SELECT team_id FROM planning.sprint WHERE id = $1`, [sprintId]);
    if (!found) throw new NotFoundException('A sprint não existe.');
    await this.lockTeam(tx, found.team_id);
    const [row]: SprintRow[] = await tx.query(`SELECT ${SPRINT_COLUMNS} FROM planning.sprint WHERE id = $1 FOR UPDATE`, [sprintId]);
    return row;
  }

  /** O dia de hoje no fuso do planeamento (RN36; F19). */
  private async today(tx: EntityManager): Promise<string> {
    const [{ today }] = await tx.query(`SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS today`, [planningTimeZone()]);
    return today;
  }

  private publish(
    tx: EntityManager,
    authorId: string,
    sprintId: string,
    eventType: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
  ) {
    return this.events.publish({ entityType: 'sprint', entityId: sprintId, eventType, oldValue, newValue, authorId }, tx);
  }
}
