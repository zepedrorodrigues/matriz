import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import type { UserSummary } from './tasks.service';

/** openapi.yaml: Comment */
export interface Comment {
  id: string;
  taskId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

/** openapi.yaml: CommentPage */
export interface CommentPage {
  page: number;
  pageSize: number;
  total: number;
  items: Comment[];
}

interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: Date;
}

/**
 * Comentários de uma tarefa (US10, RN41; Ficha PL 03, Ex. 6). Quem pode comentar e consultar (quem vê
 * o projeto, CAT06) é verificado antes pelo guarda global. O autor é sempre o utilizador autenticado e a
 * data/hora a do sistema (CA10.5). Os comentários não são editados nem eliminados (EC10.1) e não geram
 * eventos de histórico: são eles próprios registos imutáveis com autor e data.
 */
@Injectable()
export class CommentsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  /** CA10.2, D46: por ordem cronológica (do mais antigo), com o total de comentários da tarefa. */
  async list(taskId: string, page: number, pageSize: number): Promise<CommentPage> {
    const [{ total }] = await this.db.query(`SELECT count(*)::int AS total FROM work.comment WHERE task_id = $1`, [taskId]);
    const rows: CommentRow[] = await this.db.query(
      `SELECT id, task_id, author_id, body, created_at FROM work.comment WHERE task_id = $1
       ORDER BY created_at, id LIMIT $2 OFFSET $3`,
      [taskId, pageSize, (page - 1) * pageSize],
    );
    return { page, pageSize, total, items: await this.toComments(rows) };
  }

  /** CA10.1: o comentário fica guardado com o autor do token e a data/hora do sistema. */
  async add(user: AuthenticatedUser, taskId: string, body: string): Promise<Comment> {
    const row = await this.db.transaction(async (tx) => {
      // A tarefa pode ter sido eliminada depois de o guarda a verificar (RN38).
      const [task] = await tx.query(`SELECT 1 FROM work.task WHERE id = $1 AND deleted_at IS NULL FOR SHARE`, [taskId]);
      if (!task) throw new NotFoundException('A tarefa não existe.');
      const [inserted]: CommentRow[] = await tx.query(
        `INSERT INTO work.comment (task_id, author_id, body) VALUES ($1, $2, $3)
         RETURNING id, task_id, author_id, body, created_at`,
        [taskId, user.id, body],
      );
      return inserted;
    });
    const [comment] = await this.toComments([row]);
    return comment;
  }

  private async toComments(rows: CommentRow[]): Promise<Comment[]> {
    const names = await this.users.namesByIds(rows.map((r) => r.author_id));
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      author: { id: r.author_id, name: names.get(r.author_id) ?? '' },
      body: r.body,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
