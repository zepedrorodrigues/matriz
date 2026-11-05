import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { WORK_ITEM_LOCATOR, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import type { TeamRole } from './organization.entities';
import type { CreateTeamDto, MembershipDto } from './teams.dto';

export interface TeamSummary {
  id: string;
  name: string;
  active: boolean;
}

export interface TeamDetail extends TeamSummary {
  deactivatedAt: string | null;
  createdAt: string;
  openTaskCount: number;
  members: { user: { id: string; name: string }; role: TeamRole; allocationPct: number; activeTotal: number }[];
}

export interface UserMemberships {
  userId: string;
  activeTotal: number;
  memberships: { teamId: string; teamName: string; teamActive: boolean; role: TeamRole; allocationPct: number }[];
}

interface MembershipRow {
  team_id: string;
  role: TeamRole;
  allocation_pct: number;
}

const UNIQUE_VIOLATION = '23505';
const NAME_TAKEN = 'Já existe uma equipa ativa com este nome (RN33).';

/**
 * Equipas e pertenças (US01; CA01.1, CA01.7–CA01.12; RN06, RN21, RN33, RN34; F18). A autorização é
 * verificada antes pelo guarda global (§3.1: só o administrador gere equipas e pertenças). Os
 * utilizadores são do módulo Identidade (interface UserDirectory) e as tarefas do módulo Trabalho
 * (interface WorkItemLocator): nenhum dos dois é lido diretamente (architecture.md §6). Cada alteração
 * fica no histórico da equipa, na mesma transação (RN32).
 */
@Injectable()
export class TeamsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
  ) {}

  /** CA01.8: ordenadas pelo nome; as desativadas só para o administrador. */
  async list(user: AuthenticatedUser): Promise<TeamSummary[]> {
    return this.db.query(
      `SELECT id, name, active FROM organization.team WHERE active OR $1 ORDER BY lower(name), id`,
      [user.isAdmin],
    );
  }

  async get(teamId: string): Promise<TeamDetail> {
    const [team] = await this.db.query(
      `SELECT id, name, active, deactivated_at, created_at FROM organization.team WHERE id = $1`,
      [teamId],
    );
    if (!team) throw new NotFoundException('A equipa não existe.');
    const members: { user_id: string; role: TeamRole; allocation_pct: number; active_total: number }[] = await this.db.query(
      `SELECT m.user_id, m.role, m.allocation_pct,
              (SELECT coalesce(sum(o.allocation_pct), 0)::int FROM organization.team_membership o
               JOIN organization.team ot ON ot.id = o.team_id AND ot.active WHERE o.user_id = m.user_id) AS active_total
       FROM organization.team_membership m WHERE m.team_id = $1`,
      [teamId],
    );
    const names = await this.users.namesByIds(members.map((m) => m.user_id));
    const roleOrder = (r: TeamRole) => (r === 'leader' ? 0 : 1);
    return {
      id: team.id,
      name: team.name,
      active: team.active,
      deactivatedAt: team.deactivated_at ? (team.deactivated_at as Date).toISOString() : null,
      createdAt: (team.created_at as Date).toISOString(),
      openTaskCount: await this.openTaskCount(teamId),
      members: members
        .map((m) => ({
          user: { id: m.user_id, name: names.get(m.user_id) ?? '' },
          role: m.role,
          allocationPct: m.allocation_pct,
          activeTotal: m.active_total,
        }))
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.user.name.localeCompare(b.user.name, 'pt')),
    };
  }

  /**
   * CA01.1, RN34: a equipa nasce com um líder. F18, RN06: indicam-se as alocações do líder em todas as
   * suas equipas ativas (as atuais, com os papéis que já tem, e a nova), somando 100.
   */
  async create(user: AuthenticatedUser, dto: CreateTeamDto): Promise<TeamDetail> {
    await this.requireActiveUser(dto.leaderId);
    const id = await this.db.transaction(async (tx) => {
      const current = await this.lockActiveMemberships(tx, dto.leaderId);
      const given = new Map(dto.leaderOtherAllocations.map((a) => [a.teamId, a.allocationPct]));
      if (given.size !== dto.leaderOtherAllocations.length || given.size !== current.length || current.some((m) => !given.has(m.team_id))) {
        throw new UnprocessableEntityException(
          'Indique a alocação do líder em cada uma das equipas ativas a que já pertence, e só nessas (F18).',
        );
      }
      const total = dto.leaderAllocationPct + [...given.values()].reduce((sum, pct) => sum + pct, 0);
      if (total !== 100) {
        throw new UnprocessableEntityException(`As alocações do líder têm de somar 100 % (somam ${total} %, RN06).`);
      }
      let teamId: string;
      try {
        [{ id: teamId }] = await tx.query(`INSERT INTO organization.team (name) VALUES ($1) RETURNING id`, [dto.name]);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException(NAME_TAKEN);
        throw error;
      }
      await tx.query(
        `INSERT INTO organization.team_membership (team_id, user_id, role, allocation_pct) VALUES ($1, $2, 'leader', $3)`,
        [teamId, dto.leaderId, dto.leaderAllocationPct],
      );
      await this.publish(tx, user, teamId, 'created', null, { name: dto.name, leaderId: dto.leaderId });
      await this.publish(tx, user, teamId, 'member_added', null, {
        userId: dto.leaderId,
        role: 'leader',
        allocationPct: dto.leaderAllocationPct,
      });
      for (const m of current) {
        const pct = given.get(m.team_id)!;
        if (pct === m.allocation_pct) continue;
        await tx.query(`UPDATE organization.team_membership SET allocation_pct = $3 WHERE team_id = $1 AND user_id = $2`, [
          m.team_id,
          dto.leaderId,
          pct,
        ]);
        await this.publish(tx, user, m.team_id, 'member_updated', { userId: dto.leaderId, allocationPct: m.allocation_pct }, {
          userId: dto.leaderId,
          allocationPct: pct,
        });
      }
      return teamId;
    });
    return this.get(id);
  }

  /** CA01.7: só o nome muda; as associações mantêm-se. */
  async rename(user: AuthenticatedUser, teamId: string, name: string): Promise<TeamDetail> {
    await this.db.transaction(async (tx) => {
      const [team] = await tx.query(`SELECT name FROM organization.team WHERE id = $1 FOR UPDATE`, [teamId]);
      if (!team) throw new NotFoundException('A equipa não existe.');
      if (team.name === name) return;
      try {
        await tx.query(`UPDATE organization.team SET name = $2 WHERE id = $1`, [teamId, name]);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException(NAME_TAKEN);
        throw error;
      }
      await this.publish(tx, user, teamId, 'updated', { name: team.name }, { name });
    });
    return this.get(teamId);
  }

  /**
   * CA01.10, CA01.11, RN33: só sem tarefas por concluir (409 com o número). A equipa deixa de receber
   * tarefas e mantém o histórico e as pertenças; sem reativação (F18).
   */
  async deactivate(user: AuthenticatedUser, teamId: string): Promise<TeamDetail> {
    await this.db.transaction(async (tx) => {
      const [team] = await tx.query(`SELECT active FROM organization.team WHERE id = $1 FOR UPDATE`, [teamId]);
      if (!team) throw new NotFoundException('A equipa não existe.');
      if (!team.active) throw new ConflictException('A equipa já está desativada.');
      const open = await this.openTaskCount(teamId);
      if (open > 0) {
        throw new ConflictException(
          `A equipa tem ${open === 1 ? '1 tarefa' : `${open} tarefas`} por concluir: só pode ser desativada depois de estarem em «Terminada» ou «Entregue» (RN33).`,
        );
      }
      await tx.query(`UPDATE organization.team SET active = false, deactivated_at = now() WHERE id = $1`, [teamId]);
      await this.publish(tx, user, teamId, 'deactivated', { active: true }, { active: false });
    });
    return this.get(teamId);
  }

  async membershipsOf(userId: string): Promise<UserMemberships> {
    if (!(await this.users.namesByIds([userId])).has(userId)) throw new NotFoundException('O utilizador não existe.');
    const rows: { team_id: string; team_name: string; team_active: boolean; role: TeamRole; allocation_pct: number }[] =
      await this.db.query(
        `SELECT m.team_id, t.name AS team_name, t.active AS team_active, m.role, m.allocation_pct
         FROM organization.team_membership m JOIN organization.team t ON t.id = m.team_id
         WHERE m.user_id = $1 ORDER BY t.active DESC, lower(t.name)`,
        [userId],
      );
    return {
      userId,
      activeTotal: rows.filter((r) => r.team_active).reduce((sum, r) => sum + r.allocation_pct, 0),
      memberships: rows.map((r) => ({
        teamId: r.team_id,
        teamName: r.team_name,
        teamActive: r.team_active,
        role: r.role,
        allocationPct: r.allocation_pct,
      })),
    };
  }

  /**
   * CA01.9, F18: substitui o conjunto completo das pertenças em equipas ativas. RN06: soma 100 (ou
   * vazio, RN21); RN34, CA01.12: nenhuma equipa ativa fica sem líder (409). As equipas tocadas ficam
   * bloqueadas, por ordem, até ao fim da transação, para duas alterações simultâneas não deixarem uma
   * equipa sem líder.
   */
  async replaceMemberships(user: AuthenticatedUser, userId: string, input: MembershipDto[]): Promise<UserMemberships> {
    const names = await this.users.namesByIds([userId]);
    if (!names.has(userId)) throw new NotFoundException('O utilizador não existe.');
    const ids = input.map((m) => m.teamId);
    if (new Set(ids).size !== ids.length) throw new UnprocessableEntityException('Cada equipa só pode aparecer uma vez.');
    if (input.length > 0) {
      await this.requireActiveUser(userId);
      const total = input.reduce((sum, m) => sum + m.allocationPct, 0);
      if (total !== 100) throw new UnprocessableEntityException(`As alocações têm de somar 100 % (somam ${total} %, RN06).`);
    }

    await this.db.transaction(async (tx) => {
      const current = await this.lockActiveMemberships(tx, userId);
      const touched = [...new Set([...ids, ...current.map((m) => m.team_id)])].sort();
      const teams: { id: string; name: string; active: boolean }[] = touched.length
        ? await tx.query(`SELECT id, name, active FROM organization.team WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [touched])
        : [];
      const byId = new Map(teams.map((t) => [t.id, t]));
      for (const m of input) {
        if (!byId.get(m.teamId)?.active) {
          throw new UnprocessableEntityException('Só se pertence a equipas que existem e estão ativas (RN33).');
        }
      }
      const next = new Map(input.map((m) => [m.teamId, m]));
      for (const m of current) {
        if (m.role !== 'leader' || next.get(m.team_id)?.role === 'leader') continue;
        const [{ n }] = await tx.query(
          `SELECT count(*)::int AS n FROM organization.team_membership WHERE team_id = $1 AND role = 'leader' AND user_id <> $2`,
          [m.team_id, userId],
        );
        if (n === 0) {
          throw new ConflictException(`A equipa «${byId.get(m.team_id)!.name}» ficaria sem líder: designe primeiro outro líder (RN34).`);
        }
      }

      const before = new Map(current.map((m) => [m.team_id, m]));
      for (const m of current) {
        if (next.has(m.team_id)) continue;
        await tx.query(`DELETE FROM organization.team_membership WHERE team_id = $1 AND user_id = $2`, [m.team_id, userId]);
        await this.publish(tx, user, m.team_id, 'member_removed', { userId, role: m.role, allocationPct: m.allocation_pct }, null);
      }
      for (const m of input) {
        const old = before.get(m.teamId);
        if (!old) {
          await tx.query(
            `INSERT INTO organization.team_membership (team_id, user_id, role, allocation_pct) VALUES ($1, $2, $3::organization.team_role, $4)`,
            [m.teamId, userId, m.role, m.allocationPct],
          );
          await this.publish(tx, user, m.teamId, 'member_added', null, { userId, role: m.role, allocationPct: m.allocationPct });
        } else if (old.role !== m.role || old.allocation_pct !== m.allocationPct) {
          await tx.query(
            `UPDATE organization.team_membership SET role = $3::organization.team_role, allocation_pct = $4 WHERE team_id = $1 AND user_id = $2`,
            [m.teamId, userId, m.role, m.allocationPct],
          );
          await this.publish(tx, user, m.teamId, 'member_updated', { userId, role: old.role, allocationPct: old.allocation_pct }, {
            userId,
            role: m.role,
            allocationPct: m.allocationPct,
          });
        }
      }
    });
    return this.membershipsOf(userId);
  }

  /** Pertenças do utilizador em equipas ativas, bloqueadas até ao fim da transação. */
  private lockActiveMemberships(tx: EntityManager, userId: string): Promise<MembershipRow[]> {
    return tx.query(
      `SELECT m.team_id, m.role, m.allocation_pct FROM organization.team_membership m
       JOIN organization.team t ON t.id = m.team_id AND t.active
       WHERE m.user_id = $1 ORDER BY m.team_id FOR UPDATE OF m`,
      [userId],
    );
  }

  /** CA01.10: tarefas por concluir da equipa, só em projetos não eliminados (RN38). */
  private async openTaskCount(teamId: string): Promise<number> {
    const counts = await this.work.openTaskCountsOfTeam(teamId);
    if (counts.length === 0) return 0;
    const live: { id: string }[] = await this.db.query(
      `SELECT id FROM organization.project WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [counts.map((c) => c.projectId)],
    );
    const ids = new Set(live.map((p) => p.id));
    return counts.filter((c) => ids.has(c.projectId)).reduce((sum, c) => sum + c.count, 0);
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const [found] = await this.users.activeUsers([userId]);
    if (!found) throw new UnprocessableEntityException('A conta indicada não existe ou está desativada.');
  }

  private publish(
    tx: EntityManager,
    user: AuthenticatedUser,
    teamId: string,
    eventType: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
  ) {
    return this.events.publish({ entityType: 'team', entityId: teamId, eventType, oldValue, newValue, authorId: user.id }, tx);
  }
}
