import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { WORK_ITEM_LOCATOR, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';
import { workingDays } from './sprint-calendar';

export interface MemberCapacity {
  userId: string;
  name: string;
  role: 'leader' | 'member';
  allocationPct: number;
  capacityHours: number;
  availabilityAdjusted: boolean;
  plannedHours: number;
  remainingHours: number;
  overloaded: boolean;
}

export interface SprintCapacity {
  sprintId: string;
  teamId: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  capacityHours: number;
  plannedHours: number;
  remainingHours: number;
  plannedStoryPoints: number;
  tasksWithoutStoryPoints: number;
  overloaded: boolean;
  members: MemberCapacity[];
}

/** RN06: 8 horas por dia útil. */
const HOURS_PER_DAY = 8;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Capacidade e carga de uma sprint (US05; RN06, RN19, RN22, RN27; SEC06, SEC07). A capacidade não é
 * guardada: calcula-se das datas, das alocações (módulo Organização) e dos ajustes de disponibilidade; as
 * horas planeadas vêm das estimativas atuais das tarefas (módulo Trabalho, interface WorkItemLocator). A
 * sobrecarga é assinalada, nunca impedida (RN19); os alertas chegam no I11 (F20).
 */
@Injectable()
export class CapacityService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /**
   * CA05.1–CA05.4, CA05.6, CA05.7, CA05.9–CA05.11. SEC07: o líder recebe todos os membros; um membro só os
   * seus dados; o gestor e o administrador, nenhum (a não ser que sejam também líderes ou membros).
   */
  async forSprint(viewer: AuthenticatedUser, sprintId: string): Promise<SprintCapacity> {
    const computed = await this.compute(sprintId, this.db.manager);
    if (!computed) throw new NotFoundException('A sprint não existe.');
    const { result, rows, members } = computed;
    const viewerRole = members.find((m) => m.userId === viewer.id)?.role;
    return { ...result, members: viewerRole === 'leader' ? rows : viewerRole === 'member' ? rows.filter((r) => r.userId === viewer.id) : [] };
  }

  /** CA05.8 (I11): sobrecarga da equipa e de cada membro, calculada na transação indicada. */
  async overloadState(sprintId: string, manager: EntityManager): Promise<{ teamId: string; team: boolean; users: string[] } | null> {
    const [sprint] = await manager.query(`SELECT status FROM planning.sprint WHERE id = $1`, [sprintId]);
    if (!sprint || sprint.status === 'closed') return null;
    const computed = await this.compute(sprintId, manager);
    if (!computed) return null;
    return { teamId: computed.result.teamId, team: computed.result.overloaded, users: computed.rows.filter((r) => r.overloaded).map((r) => r.userId) };
  }

  async openSprintsOfTask(taskId: string, manager: EntityManager): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      `SELECT s.id FROM planning.sprint_task st JOIN planning.sprint s ON s.id = st.sprint_id
       WHERE st.task_id = $1 AND st.left_at IS NULL AND s.status IN ('planned', 'active')`,
      [taskId],
    );
    return rows.map((r) => r.id);
  }

  private async compute(
    sprintId: string,
    m: EntityManager,
  ): Promise<{ result: SprintCapacity; rows: MemberCapacity[]; members: { userId: string; role: 'leader' | 'member' }[] } | null> {
    const [sprint] = await m.query(
      `SELECT id, team_id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM planning.sprint WHERE id = $1`,
      [sprintId],
    );
    if (!sprint) return null;
    const days = workingDays(sprint.start_date, sprint.end_date);

    // Em sequência: numa transação, as consultas partilham uma só ligação (revisão do I14).
    const members = await this.organization.teamMembers(sprint.team_id, m);
    const adjustments: { user_id: string; available_hours: string }[] = await m.query(
      `SELECT user_id, available_hours FROM planning.availability_adjustment WHERE sprint_id = $1`,
      [sprintId],
    );
    const links: { task_id: string }[] = await m.query(`SELECT task_id FROM planning.sprint_task WHERE sprint_id = $1 AND left_at IS NULL`, [
      sprintId,
    ]);
    const infos = await this.work.planningTasks({ taskIds: links.map((l) => l.task_id) }, m);
    const live = await this.organization.projectNames([...new Set(infos.map((t) => t.projectId))], m);
    // RN22, CA05.9: uma tarefa com subtarefas conta 0; contam as subtarefas, cada uma na sua sprint.
    const counted = infos.filter((t) => live.has(t.projectId) && !t.hasSubtasks);
    const adjusted = new Map(adjustments.map((a) => [a.user_id, Number(a.available_hours)]));
    const names = await this.users.namesByIds(members.map((x) => x.userId), m);

    const rows: MemberCapacity[] = members
      .map((m) => {
        const capacityHours = adjusted.get(m.userId) ?? round2((HOURS_PER_DAY * days * m.allocationPct) / 100);
        const plannedHours = round2(counted.filter((t) => t.assigneeId === m.userId).reduce((sum, t) => sum + (t.estimateHours ?? 0), 0));
        return {
          userId: m.userId,
          name: names.get(m.userId) ?? '',
          role: m.role,
          allocationPct: m.allocationPct,
          capacityHours,
          availabilityAdjusted: adjusted.has(m.userId),
          plannedHours,
          remainingHours: round2(capacityHours - plannedHours),
          overloaded: plannedHours > capacityHours,
        };
      })
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'pt') : a.role === 'leader' ? -1 : 1));

    const capacityHours = round2(rows.reduce((sum, r) => sum + r.capacityHours, 0));
    const plannedHours = round2(counted.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0));
    const result: SprintCapacity = {
      sprintId,
      teamId: sprint.team_id,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
      workingDays: days,
      capacityHours,
      plannedHours,
      remainingHours: round2(capacityHours - plannedHours),
      plannedStoryPoints: counted.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
      tasksWithoutStoryPoints: counted.filter((t) => t.storyPoints === null).length,
      overloaded: plannedHours > capacityHours,
      members: rows,
    };
    return { result, rows, members };
  }

  /** CA05.5, SEC06: horas disponíveis do membro nesta sprint e nesta equipa, sem motivo; fica no histórico. */
  async setAvailability(user: AuthenticatedUser, sprintId: string, userId: string, hours: number): Promise<SprintCapacity> {
    await this.db.transaction(async (tx) => {
      const teamId = await this.openSprintTeam(tx, sprintId);
      if (!(await this.organization.teamRole(userId, teamId, tx))) {
        throw new UnprocessableEntityException('Só se ajustam as horas de membros da equipa da sprint.');
      }
      const [old] = await tx.query(
        `SELECT available_hours FROM planning.availability_adjustment WHERE sprint_id = $1 AND user_id = $2 FOR UPDATE`,
        [sprintId, userId],
      );
      await tx.query(
        `INSERT INTO planning.availability_adjustment (sprint_id, user_id, available_hours, updated_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (sprint_id, user_id) DO UPDATE SET available_hours = EXCLUDED.available_hours, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [sprintId, userId, hours, user.id],
      );
      await this.events.publish(
        {
          entityType: 'sprint',
          entityId: sprintId,
          eventType: 'availability_adjusted',
          oldValue: old ? { userId, availableHours: Number(old.available_hours) } : { userId, availableHours: null },
          newValue: { userId, availableHours: hours },
          authorId: user.id,
        },
        tx,
      );
    });
    return this.forSprint(user, sprintId);
  }

  /** Repõe o cálculo de RN06 (retira o ajuste); sem ajuste → 404. */
  async resetAvailability(user: AuthenticatedUser, sprintId: string, userId: string): Promise<SprintCapacity> {
    await this.db.transaction(async (tx) => {
      await this.openSprintTeam(tx, sprintId);
      const [removed]: [{ available_hours: string }[], number] = await tx.query(
        `DELETE FROM planning.availability_adjustment WHERE sprint_id = $1 AND user_id = $2 RETURNING available_hours`,
        [sprintId, userId],
      );
      if (removed.length === 0) throw new NotFoundException('Este membro não tem horas ajustadas nesta sprint.');
      await this.events.publish(
        {
          entityType: 'sprint',
          entityId: sprintId,
          eventType: 'availability_reset',
          oldValue: { userId, availableHours: Number(removed[0].available_hours) },
          newValue: { userId, availableHours: null },
          authorId: user.id,
        },
        tx,
      );
    });
    return this.forSprint(user, sprintId);
  }

  /** Equipa de uma sprint «Planeada» ou «Ativa», bloqueada até ao fim da transação; terminada → 409. */
  private async openSprintTeam(tx: EntityManager, sprintId: string): Promise<string> {
    const [sprint] = await tx.query(`SELECT team_id, status FROM planning.sprint WHERE id = $1 FOR UPDATE`, [sprintId]);
    if (!sprint) throw new NotFoundException('A sprint não existe.');
    if (sprint.status === 'closed') throw new ConflictException('A sprint já terminou: as horas disponíveis mantêm-se como ficaram.');
    return sprint.team_id;
  }
}
