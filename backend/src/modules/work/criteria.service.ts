import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import type { TaskState } from '../../shared/ports/work-item-locator';
import type { CriterionUpdateDto } from './work.dto';
import type { UserSummary } from './tasks.service';

/** openapi.yaml: AcceptanceCriterion */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  isMet: boolean;
  metBy: UserSummary | null;
  metAt: string | null;
}

interface CriterionRow {
  id: string;
  description: string;
  is_met: boolean;
  met_by: string | null;
  met_at: Date | null;
}

/**
 * RN13: «Terminada» significa todos os critérios cumpridos. Numa tarefa «Terminada» ou «Entregue», não
 * se acrescentam critérios nem se desmarca o cumprimento; a tarefa tem primeiro de recuar de estado
 * (decisão do humano, 2026-11-05).
 */
const FINISHED_STATES: readonly TaskState[] = ['done', 'delivered'];
const FINISHED_MESSAGE =
  'A tarefa está «Terminada» ou «Entregue», o que exige todos os critérios cumpridos (RN13): recue-a de estado antes de acrescentar critérios ou desmarcar o seu cumprimento.';

/**
 * Critérios de aceitação (US06; CA06.7–CA06.9; RN13, RN24). A autorização — quem define e altera os
 * critérios e quem regista o cumprimento — é verificada antes pelo guarda global (§3.1); aqui aplicam-se
 * as regras do domínio. Cada alteração fica no histórico, na mesma transação (RN24, RN32), com o
 * `taskId` no valor para a consulta do histórico da tarefa (I13).
 */
@Injectable()
export class CriteriaService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /** CA06.7: o critério fica associado à tarefa com o cumprimento por registar. */
  async create(user: AuthenticatedUser, taskId: string, description: string): Promise<AcceptanceCriterion> {
    const row = await this.db.transaction(async (tx) => {
      const state = await this.lockTaskState(tx, taskId);
      if (FINISHED_STATES.includes(state)) throw new ConflictException(FINISHED_MESSAGE);
      const [created]: CriterionRow[] = await tx.query(
        `INSERT INTO work.acceptance_criterion (task_id, description, created_by) VALUES ($1, $2, $3)
         RETURNING id, description, is_met, met_by, met_at`,
        [taskId, description, user.id],
      );
      await this.events.publish(
        {
          entityType: 'acceptance_criterion',
          entityId: created.id,
          eventType: 'created',
          oldValue: null,
          newValue: { taskId, description, isMet: false },
          authorId: user.id,
        },
        tx,
      );
      return created;
    });
    return this.toCriterion(row);
  }

  /**
   * CA06.9, RN24: altera o texto e/ou regista o cumprimento. Quem regista o cumprimento e quando vêm do
   * token e do sistema; ao desmarcar, ficam sem valor. Um critério de outra tarefa responde 404.
   */
  async update(user: AuthenticatedUser, taskId: string, criterionId: string, dto: CriterionUpdateDto): Promise<AcceptanceCriterion> {
    const row = await this.db.transaction(async (tx) => {
      const state = await this.lockTaskState(tx, taskId);
      const [current]: CriterionRow[] = await tx.query(
        `SELECT id, description, is_met, met_by, met_at FROM work.acceptance_criterion
         WHERE id = $1 AND task_id = $2 FOR UPDATE`,
        [criterionId, taskId],
      );
      if (!current) throw new NotFoundException('O critério de aceitação não existe nesta tarefa.');

      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};
      if (dto.description !== undefined && dto.description !== current.description) {
        oldValue.description = current.description;
        newValue.description = dto.description;
      }
      if (dto.isMet !== undefined && dto.isMet !== current.is_met) {
        if (!dto.isMet && FINISHED_STATES.includes(state)) throw new ConflictException(FINISHED_MESSAGE);
        oldValue.isMet = current.is_met;
        newValue.isMet = dto.isMet;
      }
      if (Object.keys(newValue).length === 0) return current;

      const [updated]: [CriterionRow[], number] = await tx.query(
        `UPDATE work.acceptance_criterion
         SET description = $2,
             is_met = $3,
             met_by = CASE WHEN $3 THEN (CASE WHEN is_met THEN met_by ELSE $4::uuid END) END,
             met_at = CASE WHEN $3 THEN (CASE WHEN is_met THEN met_at ELSE now() END) END
         WHERE id = $1
         RETURNING id, description, is_met, met_by, met_at`,
        [criterionId, dto.description ?? current.description, dto.isMet ?? current.is_met, user.id],
      );
      await this.events.publish(
        {
          entityType: 'acceptance_criterion',
          entityId: criterionId,
          eventType: 'criterion_changed',
          oldValue,
          newValue: { taskId, ...newValue },
          authorId: user.id,
        },
        tx,
      );
      return updated[0];
    });
    return this.toCriterion(row);
  }

  /** Bloqueia a tarefa não eliminada durante a transação, para o estado não mudar entretanto; senão 404. */
  private async lockTaskState(tx: EntityManager, taskId: string): Promise<TaskState> {
    const [task] = await tx.query(`SELECT state FROM work.task WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [taskId]);
    if (!task) throw new NotFoundException('A tarefa não existe.');
    return task.state;
  }

  private async toCriterion(row: CriterionRow): Promise<AcceptanceCriterion> {
    const names = row.met_by ? await this.users.namesByIds([row.met_by]) : new Map<string, string>();
    return {
      id: row.id,
      description: row.description,
      isMet: row.is_met,
      metBy: row.met_by ? { id: row.met_by, name: names.get(row.met_by) ?? '' } : null,
      metAt: row.met_at ? row.met_at.toISOString() : null,
    };
  }
}
