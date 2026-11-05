import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Project, ProjectManager, ProjectTeam, Team, TeamMembership, TeamRole } from './organization.entities';

export interface UserTeam {
  teamId: string;
  teamName: string;
  role: TeamRole;
  allocationPct: number;
}

/**
 * Interface pública de leitura do módulo Organização (architecture.md §6): papéis por equipa e por
 * projeto de um utilizador, usados pela avaliação da matriz de permissões (requirements.md §3.1).
 * Só considera equipas ativas e projetos não eliminados (RN38).
 */
@Injectable()
export class OrganizationReader {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Equipas ativas a que o utilizador pertence, com o papel e a alocação (RN06, RN21). */
  async teamsOf(userId: string): Promise<UserTeam[]> {
    const rows = await this.db
      .getRepository(TeamMembership)
      .createQueryBuilder('m')
      .innerJoin(Team, 't', 't.id = m.teamId AND t.active')
      .select(['m.teamId AS "teamId"', 't.name AS "teamName"', 'm.role AS "role"', 'm.allocationPct AS "allocationPct"'])
      .where('m.userId = :userId', { userId })
      .orderBy('t.name')
      .getRawMany<UserTeam>();
    return rows.map((r) => ({ ...r, allocationPct: Number(r.allocationPct) }));
  }

  /** Projetos não eliminados de que o utilizador é gestor. */
  async managedProjectIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .getRepository(ProjectManager)
      .createQueryBuilder('pm')
      .innerJoin(Project, 'p', 'p.id = pm.projectId AND p.deletedAt IS NULL')
      .select('pm.projectId', 'projectId')
      .where('pm.userId = :userId', { userId })
      .orderBy('pm.projectId')
      .getRawMany<{ projectId: string }>();
    return rows.map((r) => r.projectId);
  }

  /**
   * §3.1 Visibilidade: projetos em que participa uma equipa ativa do utilizador ou de que é
   * gestor. (O administrador vê todos; isso decide-se na matriz de permissões.)
   */
  async isProjectVisibleToMember(userId: string, projectId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM organization.project p
         WHERE p.id = $2 AND p.deleted_at IS NULL AND (
           EXISTS (SELECT 1 FROM organization.project_manager pm WHERE pm.project_id = p.id AND pm.user_id = $1)
           OR EXISTS (
             SELECT 1 FROM organization.project_team pt
             JOIN organization.team t ON t.id = pt.team_id AND t.active
             JOIN organization.team_membership m ON m.team_id = t.id AND m.user_id = $1
             WHERE pt.project_id = p.id))
       ) AS visible`,
      [userId, projectId],
    );
    return row.visible === true;
  }

  /** O projeto existe e não foi eliminado (RN38: um projeto eliminado responde como inexistente). */
  async projectExists(projectId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM organization.project WHERE id = $1 AND deleted_at IS NULL) AS found`,
      [projectId],
    );
    return row.found === true;
  }

  async isProjectManager(userId: string, projectId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM organization.project_manager WHERE project_id = $2 AND user_id = $1) AS manager`,
      [userId, projectId],
    );
    return row.manager === true;
  }

  /** É líder de pelo menos uma equipa ativa (RN25, D48: os líderes criam projetos). */
  async leadsAnActiveTeam(userId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM organization.team_membership m JOIN organization.team t ON t.id = m.team_id AND t.active
         WHERE m.user_id = $1 AND m.role = 'leader') AS leader`,
      [userId],
    );
    return row.leader === true;
  }

  /** Papel do utilizador numa equipa ativa, ou null se não pertencer a ela (RN21). */
  async teamRole(userId: string, teamId: string): Promise<TeamRole | null> {
    const [row] = await this.db.query(
      `SELECT m.role FROM organization.team_membership m JOIN organization.team t ON t.id = m.team_id AND t.active
       WHERE m.user_id = $1 AND m.team_id = $2`,
      [userId, teamId],
    );
    return (row?.role as TeamRole | undefined) ?? null;
  }

  /** Membros (líderes incluídos) de uma equipa ativa; vazio se a equipa estiver desativada (RN40). */
  async memberIds(teamId: string): Promise<string[]> {
    const rows: { user_id: string }[] = await this.db.query(
      `SELECT m.user_id FROM organization.team_membership m JOIN organization.team t ON t.id = m.team_id AND t.active
       WHERE m.team_id = $1`,
      [teamId],
    );
    return rows.map((r) => r.user_id);
  }

  /** É líder de uma equipa ativa associada ao projeto (§3.1: criar objetivos e épicos). */
  async leadsTeamOnProject(userId: string, projectId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM organization.project_team pt
         JOIN organization.team t ON t.id = pt.team_id AND t.active
         JOIN organization.team_membership m ON m.team_id = t.id AND m.user_id = $1 AND m.role = 'leader'
         WHERE pt.project_id = $2) AS leader`,
      [userId, projectId],
    );
    return row.leader === true;
  }

  /** A equipa está ativa e associada ao projeto: só assim pode ser responsável por tarefas (RN23, RN33). */
  async isActiveTeamOfProject(teamId: string, projectId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM organization.project_team pt JOIN organization.team t ON t.id = pt.team_id AND t.active
         WHERE pt.project_id = $2 AND pt.team_id = $1) AS ok`,
      [teamId, projectId],
    );
    return row.ok === true;
  }
}

export const ORGANIZATION_ENTITIES = [Team, TeamMembership, Project, ProjectManager, ProjectTeam];
