import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { TaskAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ParticipantsService } from './participants.service';
import type { Participant } from './participants.service';
import type { UserSummary } from './tasks.service';
import { EligibleQuery, ParticipantInputDto } from './work.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * openapi.yaml: listEligibleUsers, listParticipants, addParticipant, removeParticipant. A autorização e a
 * elegibilidade de quem é escolhido são declaradas em cada rota e verificadas pelo guarda global (§3.1).
 */
@Controller('tasks/:taskId')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get('eligible-users')
  @TaskAccess('listEligible')
  eligible(@Param('taskId') taskId: string, @Query() query: EligibleQuery): Promise<UserSummary[]> {
    return this.participants.eligible(taskId, query.scope ?? 'team');
  }

  @Get('participants')
  @TaskAccess('view')
  list(@Param('taskId') taskId: string): Promise<Participant[]> {
    return this.participants.list(taskId);
  }

  @Post('participants')
  @TaskAccess('addParticipant')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: ParticipantInputDto,
  ): Promise<Participant> {
    return this.participants.add(user, taskId, dto.userId, dto.justification);
  }

  @Delete('participants/:userId')
  @TaskAccess('removeParticipant')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string, @Param('userId') userId: string): Promise<void> {
    // Identificador mal formado: o mesmo que um participante inexistente (404), sem chegar à base.
    if (!UUID.test(userId)) throw new NotFoundException('Este utilizador não é participante da tarefa.');
    await this.participants.remove(user, taskId, userId);
  }
}
