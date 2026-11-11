import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { DomainEvents } from '../../shared/events/domain-events';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { OrganizationReader } from '../organization/organization-reader.service';
import type { UserSummary } from './tasks.service';

/** openapi.yaml: Participant */
export interface Participant {
  user: UserSummary;
  addedBy: UserSummary;
  addedAt: string;
}

interface ParticipantRow {
  user_id: string;
  added_by: string;
  added_at: Date;
}

/** Violação da chave primária (task_id, user_id): o participante já está associado (CA03.14). */
const UNIQUE_VIOLATION = '23505';

/**
 * Utilizadores elegíveis e participantes de uma tarefa (RN03, RN40; Ficha PL 03, Ex. 6). A autorização
 * e a elegibilidade de quem é escolhido (existência, equipa, justificação) são verificadas antes pelo
 * guarda global (§3.1); aqui aplicam-se as regras do domínio — sem repetições (409) — e cada associação
 * e remoção fica no histórico da tarefa, na mesma transação (RN32).
 */
@Injectable()
export class ParticipantsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly events: DomainEvents,
    private readonly organization: OrganizationReader,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /**
   * `team`: membros ativos da equipa responsável; `all`: todos os utilizadores ativos (o guarda só o
   * permite ao gestor e ao administrador, RN03). Ordenados pelo nome.
   */
  async eligible(taskId: string, scope: 'team' | 'all'): Promise<UserSummary[]> {
    if (scope === 'all') return this.users.activeUsers();
    const [task] = await this.db.query(`SELECT team_id FROM work.task WHERE id = $1 AND deleted_at IS NULL`, [taskId]);
    if (!task) throw new NotFoundException('A tarefa não existe.');
    return this.users.activeUsers(await this.organization.memberIds(task.team_id));
  }

  async list(taskId: string): Promise<Participant[]> {
    const rows: ParticipantRow[] = await this.db.query(
      `SELECT user_id, added_by, added_at FROM work.task_participant WHERE task_id = $1 ORDER BY added_at, user_id`,
      [taskId],
    );
    return this.toParticipants(rows);
  }

  /**
   * CA03.13: associa um participante sem alterar o responsável pela execução; CA03.14: um utilizador já
   * associado é recusado (409) e a associação não fica duplicada. A justificação (RN03) fica no histórico.
   */
  async add(user: AuthenticatedUser, taskId: string, userId: string, justification?: string): Promise<Participant> {
    const row = await this.db.transaction(async (tx) => {
      const teamId = await this.lockTask(tx, taskId);
      const [existing] = await tx.query(`SELECT 1 FROM work.task_participant WHERE task_id = $1 AND user_id = $2`, [
        taskId,
        userId,
      ]);
      if (existing) throw new ConflictException('Este utilizador já é participante da tarefa.');
      let inserted: ParticipantRow;
      try {
        [inserted] = await tx.query(
          `INSERT INTO work.task_participant (task_id, user_id, added_by) VALUES ($1, $2, $3)
           RETURNING user_id, added_by, added_at`,
          [taskId, userId, user.id],
        );
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictException('Este utilizador já é participante da tarefa.');
        }
        throw error;
      }
      const crossTeam = !(await this.organization.teamRole(userId, teamId, tx));
      await this.events.publish(
        {
          entityType: 'task',
          entityId: taskId,
          eventType: 'participant_added',
          oldValue: null,
          newValue: { userId, ...(crossTeam ? { crossTeam: true, justification } : {}) },
          authorId: user.id,
        },
        tx,
      );
      return inserted;
    });
    const [participant] = await this.toParticipants([row]);
    return participant;
  }

  /** CA03.16: o utilizador deixa de ser participante e a remoção fica no histórico. */
  async remove(user: AuthenticatedUser, taskId: string, userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const [, removed]: [unknown[], number] = await tx.query(
        `DELETE FROM work.task_participant WHERE task_id = $1 AND user_id = $2`,
        [taskId, userId],
      );
      if (removed === 0) throw new NotFoundException('Este utilizador não é participante da tarefa.');
      await this.events.publish(
        {
          entityType: 'task',
          entityId: taskId,
          eventType: 'participant_removed',
          oldValue: { userId },
          newValue: null,
          authorId: user.id,
        },
        tx,
      );
    });
  }

  /** Bloqueia a tarefa não eliminada durante a transação; devolve a equipa responsável. Senão 404. */
  private async lockTask(tx: EntityManager, taskId: string): Promise<string> {
    const [task] = await tx.query(`SELECT team_id FROM work.task WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [taskId]);
    if (!task) throw new NotFoundException('A tarefa não existe.');
    return task.team_id;
  }

  private async toParticipants(rows: ParticipantRow[]): Promise<Participant[]> {
    const names = await this.users.namesByIds(rows.flatMap((r) => [r.user_id, r.added_by]));
    const person = (id: string): UserSummary => ({ id, name: names.get(id) ?? '' });
    return rows.map((r) => ({ user: person(r.user_id), addedBy: person(r.added_by), addedAt: r.added_at.toISOString() }));
  }
}
