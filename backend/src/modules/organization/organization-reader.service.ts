import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
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

  /**
   * §3.1 Visibilidade (CAT06), em lista: projetos não eliminados em que participa uma equipa ativa do
   * utilizador ou de que é gestor; o administrador vê todos. Ordenados pelo nome (painel inicial, CA07.9).
   */
  async visibleProjects(userId: string, isAdmin: boolean): Promise<{ id: string; name: string }[]> {
    return this.db.query(
      `SELECT p.id, p.name FROM organization.project p
       WHERE p.deleted_at IS NULL AND ($2 OR EXISTS (
           SELECT 1 FROM organization.project_manager pm WHERE pm.project_id = p.id AND pm.user_id = $1)
         OR EXISTS (
           SELECT 1 FROM organization.project_team pt
           JOIN organization.team t ON t.id = pt.team_id AND t.active
           JOIN organization.team_membership m ON m.team_id = t.id AND m.user_id = $1
           WHERE pt.project_id = p.id))
       ORDER BY lower(p.name), p.id`,
      [userId, isAdmin],
    );
  }

  /** O projeto existe e não foi eliminado (RN38: um projeto eliminado responde como inexistente). */
  /** `withDeleted`: conta também os eliminados — só para o histórico, consultado pelo administrador (RN38, D50). */
  async projectExists(projectId: string, withDeleted = false): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM organization.project WHERE id = $1 AND ($2 OR deleted_at IS NULL)) AS found`,
      [projectId, withDeleted],
    );
    return row.found === true;
  }

  async isProjectManager(userId: string, projectId: string, manager?: EntityManager): Promise<boolean> {
    const [row] = await (manager ?? this.db).query(
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
  async teamRole(userId: string, teamId: string, manager?: EntityManager): Promise<TeamRole | null> {
    const [row] = await (manager ?? this.db).query(
      `SELECT m.role FROM organization.team_membership m JOIN organization.team t ON t.id = m.team_id AND t.active
       WHERE m.user_id = $1 AND m.team_id = $2`,
      [userId, teamId],
    );
    return (row?.role as TeamRole | undefined) ?? null;
  }

  /**
   * Papel do utilizador na equipa, ativa ou desativada — só para o histórico: uma equipa desativada mantém as
   * pertenças (RN33) e o seu histórico continua consultável por quem lhe pertence (CA01.11, D50, opção 1).
   */
  async historyTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
    const [row] = await this.db.query(`SELECT role FROM organization.team_membership WHERE user_id = $1 AND team_id = $2`, [userId, teamId]);
    return (row?.role as TeamRole | undefined) ?? null;
  }

  /** Membros de uma equipa (líderes incluídos) com o papel e a alocação, para a capacidade (RN06, I10). */
  async teamMembers(teamId: string, manager?: EntityManager): Promise<{ userId: string; role: TeamRole; allocationPct: number }[]> {
    const rows: { user_id: string; role: TeamRole; allocation_pct: number }[] = await (manager ?? this.db).query(
      `SELECT user_id, role, allocation_pct FROM organization.team_membership WHERE team_id = $1`,
      [teamId],
    );
    return rows.map((r) => ({ userId: r.user_id, role: r.role, allocationPct: r.allocation_pct }));
  }

  /**
   * CAT06, decisão 2a (I14): projetos cujas tarefas o utilizador pode ver nas vistas de uma equipa (backlog,
   * sprints, trabalho da equipa). `null` = sem restrição (administrador ou quem pertence à equipa); senão,
   * os projetos que vê — p. ex. o gestor de um dos projetos da equipa vê só as tarefas desse projeto.
   */
  async projectScope(user: { id: string; isAdmin: boolean }, teamId: string): Promise<Set<string> | null> {
    if (user.isAdmin || (await this.teamRole(user.id, teamId))) return null;
    return new Set((await this.visibleProjects(user.id, false)).map((p) => p.id));
  }

  /** É gestor de um projeto não eliminado em que a equipa participa (§3.1: consultar a capacidade, F20). */
  async managesProjectOfTeam(userId: string, teamId: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM organization.project_team pt
         JOIN organization.project p ON p.id = pt.project_id AND p.deleted_at IS NULL
         JOIN organization.project_manager pm ON pm.project_id = p.id AND pm.user_id = $1
         WHERE pt.team_id = $2) AS manages`,
      [userId, teamId],
    );
    return row.manages === true;
  }

  /** Nomes das equipas indicadas (alertas de sobrecarga, I11). */
  async teamNames(teamIds: string[]): Promise<Map<string, { name: string; active: boolean }>> {
    if (teamIds.length === 0) return new Map();
    const rows: { id: string; name: string; active: boolean }[] = await this.db.query(
      `SELECT id, name, active FROM organization.team WHERE id = ANY($1::uuid[])`,
      [teamIds],
    );
    return new Map(rows.map((r) => [r.id, { name: r.name, active: r.active }]));
  }

  /** Estado de uma equipa: null se não existir (planeamento, I9). */
  async teamStatus(teamId: string, manager?: EntityManager): Promise<{ active: boolean } | null> {
    const [row] = await (manager ?? this.db).query(`SELECT active FROM organization.team WHERE id = $1`, [teamId]);
    return row ? { active: row.active } : null;
  }

  /** Nomes dos projetos não eliminados indicados (RN38: os eliminados ficam de fora). */
  async projectNames(projectIds: string[], manager?: EntityManager): Promise<Map<string, string>> {
    if (projectIds.length === 0) return new Map();
    const rows: { id: string; name: string }[] = await (manager ?? this.db).query(
      `SELECT id, name FROM organization.project WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [projectIds],
    );
    return new Map(rows.map((r) => [r.id, r.name]));
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

  /**
   * A equipa está ativa e associada ao projeto: só assim pode ser responsável por tarefas (RN23, RN33).
   * Com `manager`, a linha da equipa fica partilhada até ao fim da transação: uma desativação concorrente
   * espera e já conta a tarefa que esta transação cria ou transfere (RN33).
   */
  async isActiveTeamOfProject(teamId: string, projectId: string, manager?: EntityManager): Promise<boolean> {
    const rows: unknown[] = await (manager ?? this.db).query(
      `SELECT 1 FROM organization.project_team pt JOIN organization.team t ON t.id = pt.team_id AND t.active
       WHERE pt.project_id = $2 AND pt.team_id = $1 FOR SHARE OF t`,
      [teamId, projectId],
    );
    return rows.length > 0;
  }
}

export const ORGANIZATION_ENTITIES = [Team, TeamMembership, Project, ProjectManager, ProjectTeam];
