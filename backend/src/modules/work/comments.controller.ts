import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TaskAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ValidationFailedException } from '../../shared/errors/problem-details.filter';
import { CommentsService } from './comments.service';
import type { Comment, CommentPage } from './comments.service';
import { ListCommentsQuery } from './work.dto';

const BODY_MESSAGE = 'O comentário tem de ter entre 1 e 2000 caracteres e não pode ter só espaços.';

/**
 * openapi.yaml: listComments, addComment. Comentam e consultam os comentários quem vê o projeto da
 * tarefa (RN41, CA10.4), verificado pelo guarda global.
 */
@Controller('tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @TaskAccess('view')
  list(@Param('taskId') taskId: string, @Query() query: ListCommentsQuery): Promise<CommentPage> {
    return this.comments.list(taskId, query.page ?? 1, query.pageSize ?? 20);
  }

  /**
   * CA10.5 (decisão do humano, F16): ao contrário do resto da API, os outros campos enviados — p. ex. um
   * autor ou uma data — são ignorados, e o comentário é guardado com o autor do token. Por isso só se lê
   * o campo `body` (a validação global não se aplica a um valor sem tipo) e valida-se aqui (RN41: de 1 a
   * 2000 caracteres depois de retirar os espaços no início e no fim).
   */
  @Post()
  @TaskAccess('view')
  add(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string, @Body('body') body: unknown): Promise<Comment> {
    const text = typeof body === 'string' ? body.trim() : '';
    if (text.length < 1 || text.length > 2000) throw new ValidationFailedException([{ field: 'body', message: BODY_MESSAGE }]);
    return this.comments.add(user, taskId, text);
  }
}
