import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import type { CreateProjectDto, UpdateProjectDto } from './project.dto';

export interface ProjectSummary {
  id: string;
  name: string;
  objective: string | null;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  managers: { id: string; name: string }[];
  teams: { id: string; name: string; active: boolean }[];
}

export interface ProjectPage {
  page: number;
  pageSize: number;
  total: number;
  items: ProjectSummary[];
}

interface ProjectRow {
  id: string;
  name: string;
  objective: string | null;
  created_at: Date;
}

const toSummary = (r: ProjectRow): ProjectSummary => ({
  id: r.id,
  name: r.name,
  objective: r.objective,
  createdAt: r.created_at.toISOString(),
});

/** Escapa os caracteres especiais do ILIKE, para pesquisar o texto tal como foi escrito. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Projetos (US01; Ficha PL 03, Ex. 4). A autorização de cada operação é verificada antes pelo guarda
 * global (§3.1); aqui aplica-se a visibilidade nas listagens (CAT06) e a eliminação lógica (RN38).
 * Cada alteração publica um evento de domínio, registado no histórico na mesma transação (RN32).
 */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /** CA01.8, CA01.14, D46: projetos visíveis, pesquisa pelo nome, ordenados pelo nome, com o total. */
  async list(user: AuthenticatedUser, q: string | undefined, page: number, pageSize: number): Promise<ProjectPage> {
    const params: unknown[] = [user.id, user.isAdmin];
    let where = `p.deleted_at IS NULL AND ($2 OR EXISTS (
        SELECT 1 FROM organization.project_manager pm WHERE pm.project_id = p.id AND pm.user_id = $1)
      OR EXISTS (
        SELECT 1 FROM organization.project_team pt
        JOIN organization.team t ON t.id = pt.team_id AND t.active
        JOIN organization.team_membership m ON m.team_id = t.id AND m.user_id = $1
        WHERE pt.project_id = p.id))`;
    const search = q?.trim();
    if (search) {
      params.push(likePattern(search));
      where += ` AND p.name ILIKE $${params.length}`;
    }
    const [{ total }] = await this.db.query(`SELECT count(*)::int AS total FROM organization.project p WHERE ${where}`, params);
    const rows: ProjectRow[] = await this.db.query(
      `SELECT p.id, p.name, p.objective, p.created_at FROM organization.project p WHERE ${where}
       ORDER BY lower(p.name), p.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { page, pageSize, total, items: rows.map(toSummary) };
  }

  /** CA01.2: quem cria passa a ser gestor; a identidade vem do token (Ficha PL 03, Ex. 3.3). */
  async create(user: AuthenticatedUser, dto: CreateProjectDto): Promise<ProjectDetail> {
    const objective = dto.objective ? dto.objective : null;
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        `INSERT INTO organization.project (name, objective) VALUES ($1, $2) RETURNING id`,
        [dto.name, objective],
      );
      await tx.query(`INSERT INTO organization.project_manager (project_id, user_id) VALUES ($1, $2)`, [row.id, user.id]);
      await this.events.publish(
        {
          entityType: 'project',
          entityId: row.id,
          eventType: 'created',
          oldValue: null,
          newValue: { name: dto.name, objective, managerId: user.id },
          authorId: user.id,
        },
        tx,
      );
      return row.id as string;
    });
    return this.get(id);
  }

  /** CA01.4, CA01.8: projeto com gestores e equipas associadas. */
  async get(projectId: string): Promise<ProjectDetail> {
    const [row]: ProjectRow[] = await this.db.query(
      `SELECT id, name, objective, created_at FROM organization.project WHERE id = $1 AND deleted_at IS NULL`,
      [projectId],
    );
    if (!row) throw new NotFoundException('O projeto não existe.');
    const managerRows: { user_id: string }[] = await this.db.query(
      `SELECT user_id FROM organization.project_manager WHERE project_id = $1`,
      [projectId],
    );
    const names = await this.users.namesByIds(managerRows.map((m) => m.user_id));
    const managers = managerRows
      .map((m) => ({ id: m.user_id, name: names.get(m.user_id) ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return { ...toSummary(row), managers, teams: await this.teams(projectId) };
  }

  /** CA01.4: equipas associadas ao projeto, ordenadas pelo nome (as desativadas continuam associadas). */
  teams(projectId: string, manager: EntityManager = this.db.manager): Promise<{ id: string; name: string; active: boolean }[]> {
    return manager.query(
      `SELECT t.id, t.name, t.active FROM organization.project_team pt JOIN organization.team t ON t.id = pt.team_id
       WHERE pt.project_id = $1 ORDER BY lower(t.name), t.id`,
      [projectId],
    );
  }

  /**
   * CA01.3, CA01.5, RN33: associa uma equipa ativa ao projeto; uma associação repetida é recusada (409) e
   * não fica duplicada. A autorização (administrador ou gestor do projeto) foi verificada pelo guarda.
   */
  async addTeam(user: AuthenticatedUser, projectId: string, teamId: string): Promise<{ id: string; name: string; active: boolean }[]> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx.query(`SELECT 1 FROM organization.project WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [projectId]);
      if (!project) throw new NotFoundException('O projeto não existe.');
      const [team] = await tx.query(`SELECT name, active FROM organization.team WHERE id = $1 FOR SHARE`, [teamId]);
      if (!team?.active) throw new UnprocessableEntityException('A equipa não existe ou está desativada (RN33).');
      const [existing] = await tx.query(`SELECT 1 FROM organization.project_team WHERE project_id = $1 AND team_id = $2`, [projectId, teamId]);
      if (existing) throw new ConflictException('Esta equipa já está associada ao projeto.');
      await tx.query(`INSERT INTO organization.project_team (project_id, team_id) VALUES ($1, $2)`, [projectId, teamId]);
      await this.events.publish(
        {
          entityType: 'project',
          entityId: projectId,
          eventType: 'team_added',
          oldValue: null,
          newValue: { teamId, teamName: team.name },
          authorId: user.id,
        },
        tx,
      );
      return this.teams(projectId, tx);
    });
  }

  /** CA01.6: altera só os campos enviados; as equipas e os objetivos mantêm-se. */
  async update(user: AuthenticatedUser, projectId: string, dto: UpdateProjectDto): Promise<ProjectDetail> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockActive(tx, projectId);
      const next = {
        name: dto.name ?? current.name,
        objective: dto.objective === undefined ? current.objective : dto.objective || null,
      };
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};
      for (const key of ['name', 'objective'] as const) {
        if (next[key] !== current[key]) {
          oldValue[key] = current[key];
          newValue[key] = next[key];
        }
      }
      if (Object.keys(newValue).length === 0) return;
      await tx.query(`UPDATE organization.project SET name = $2, objective = $3 WHERE id = $1`, [
        projectId,
        next.name,
        next.objective,
      ]);
      await this.events.publish(
        { entityType: 'project', entityId: projectId, eventType: 'updated', oldValue, newValue, authorId: user.id },
        tx,
      );
    });
    return this.get(projectId);
  }

  /**
   * CA01.15, RN38: eliminação lógica. O projeto, e com ele a sua hierarquia, deixa de constar das
   * listagens, pesquisas e contagens; nada é apagado fisicamente e o histórico regista a eliminação.
   */
  async delete(user: AuthenticatedUser, projectId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockActive(tx, projectId);
      await tx.query(`UPDATE organization.project SET deleted_at = now() WHERE id = $1`, [projectId]);
      await this.events.publish(
        {
          entityType: 'project',
          entityId: projectId,
          eventType: 'deleted',
          oldValue: { name: current.name, objective: current.objective },
          newValue: null,
          authorId: user.id,
        },
        tx,
      );
    });
  }

  /** Bloqueia a linha do projeto ativo durante a transação; eliminado ou inexistente → 404. */
  private async lockActive(tx: EntityManager, projectId: string): Promise<{ name: string; objective: string | null }> {
    const [row] = await tx.query(
      `SELECT name, objective FROM organization.project WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [projectId],
    );
    if (!row) throw new NotFoundException('O projeto não existe.');
    return row;
  }
}
