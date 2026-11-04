import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import type { ElementInputDto } from './work.dto';

export interface Epic {
  id: string;
  objectiveId: string;
  title: string;
  description: string | null;
}

export interface Objective {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  epics: Epic[];
}

/**
 * Os dois níveis superiores da hierarquia (US02, RN12): objetivos, no topo do projeto, e épicos.
 * A autorização é verificada antes pelo guarda global (§3.1). Cada criação fica no histórico (RN32).
 */
@Injectable()
export class HierarchyService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
  ) {}

  /** CA02.6: objetivos do projeto, cada um com os seus épicos, pela ordem de criação. */
  async listObjectives(projectId: string): Promise<Objective[]> {
    const objectives: { id: string; title: string; description: string | null }[] = await this.db.query(
      `SELECT id, title, description FROM work.objective WHERE project_id = $1 ORDER BY created_at, id`,
      [projectId],
    );
    const epics: { id: string; objective_id: string; title: string; description: string | null }[] = await this.db.query(
      `SELECT e.id, e.objective_id, e.title, e.description
       FROM work.epic e JOIN work.objective o ON o.id = e.objective_id
       WHERE o.project_id = $1 ORDER BY e.created_at, e.id`,
      [projectId],
    );
    return objectives.map((o) => ({
      id: o.id,
      projectId,
      title: o.title,
      description: o.description,
      epics: epics
        .filter((e) => e.objective_id === o.id)
        .map((e) => ({ id: e.id, objectiveId: e.objective_id, title: e.title, description: e.description })),
    }));
  }

  /** CA02.1: o objetivo fica no nível de topo da hierarquia do projeto (RN12, RN23). */
  async createObjective(user: AuthenticatedUser, projectId: string, dto: ElementInputDto): Promise<Objective> {
    const description = dto.description || null;
    return this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        `INSERT INTO work.objective (project_id, title, description) VALUES ($1, $2, $3) RETURNING id`,
        [projectId, dto.title, description],
      );
      await this.events.publish(
        {
          entityType: 'objective',
          entityId: row.id,
          eventType: 'created',
          oldValue: null,
          newValue: { projectId, title: dto.title, description },
          authorId: user.id,
        },
        tx,
      );
      return { id: row.id, projectId, title: dto.title, description, epics: [] };
    });
  }

  /** CA02.2: o épico integra a hierarquia do objetivo e pertence ao mesmo projeto (RN23). */
  async createEpic(user: AuthenticatedUser, objectiveId: string, dto: ElementInputDto): Promise<Epic> {
    const description = dto.description || null;
    return this.db.transaction(async (tx) => {
      const [objective] = await tx.query(`SELECT id FROM work.objective WHERE id = $1 FOR SHARE`, [objectiveId]);
      if (!objective) throw new NotFoundException('O objetivo não existe.');
      const [row] = await tx.query(
        `INSERT INTO work.epic (objective_id, title, description) VALUES ($1, $2, $3) RETURNING id`,
        [objectiveId, dto.title, description],
      );
      await this.events.publish(
        {
          entityType: 'epic',
          entityId: row.id,
          eventType: 'created',
          oldValue: null,
          newValue: { objectiveId, title: dto.title, description },
          authorId: user.id,
        },
        tx,
      );
      return { id: row.id, objectiveId, title: dto.title, description };
    });
  }
}
