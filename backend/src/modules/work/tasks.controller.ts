import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ProjectAccess, TaskAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ValidationFailedException } from '../../shared/errors/problem-details.filter';
import { CreateTaskDto, ListTasksQuery, StateChangeDto, TransferTaskDto, UpdateTaskDto } from './work.dto';
import { TasksService } from './tasks.service';
import type { Task, TaskPage, TaskTransfer } from './tasks.service';

/**
 * openapi.yaml: listProjectTasks, createTask, getTask, updateTask, deleteTask, changeTaskState, transferTask.
 * A autorização de cada rota é declarada aqui e verificada pelo guarda global (§3.1).
 */
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  @ProjectAccess('view')
  list(@Param('projectId') projectId: string, @Query() query: ListTasksQuery): Promise<TaskPage> {
    return this.tasks.list(projectId, { state: query.state, priority: query.priority }, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post('projects/:projectId/tasks')
  @ProjectAccess('createTask')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<Task> {
    // TaskCreate (oneOf): épico e equipa numa tarefa, ou tarefa principal numa subtarefa (RN12, RN22, CA02.9).
    if (dto.parentTaskId ? dto.epicId !== undefined : !dto.epicId || !dto.teamId) {
      throw new ValidationFailedException([
        {
          field: dto.parentTaskId ? 'epicId' : dto.epicId ? 'teamId' : 'epicId',
          message: dto.parentTaskId
            ? 'Uma subtarefa indica só a tarefa principal, não o épico.'
            : dto.epicId
              ? 'Indique a equipa responsável.'
              : 'Uma tarefa pertence sempre a um épico: indique o épico (ou a tarefa principal, numa subtarefa).',
        },
      ]);
    }
    return this.tasks.create(user, projectId, dto);
  }

  @Get('tasks/:taskId')
  @TaskAccess('view')
  get(@Param('taskId') taskId: string): Promise<Task> {
    return this.tasks.get(taskId);
  }

  @Patch('tasks/:taskId')
  @TaskAccess('edit')
  update(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string, @Body() dto: UpdateTaskDto): Promise<Task> {
    const fields = [
      dto.title,
      dto.description,
      dto.priority,
      dto.estimateHours,
      dto.storyPoints,
      dto.assigneeId,
      dto.dueDate,
      dto.isBlocked,
      dto.blockReason,
    ];
    if (fields.every((value) => value === undefined)) {
      throw new ValidationFailedException([{ field: '', message: 'Indique pelo menos um campo a alterar.' }]);
    }
    if (dto.assignmentJustification !== undefined && !dto.assigneeId) {
      throw new ValidationFailedException([
        { field: 'assignmentJustification', message: 'A justificação acompanha a atribuição de um responsável (assigneeId).' },
      ]);
    }
    return this.tasks.update(user, taskId, dto);
  }

  @Post('tasks/:taskId/state')
  @TaskAccess('changeState')
  @HttpCode(200)
  changeState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: StateChangeDto,
  ): Promise<Task> {
    return this.tasks.changeState(user, taskId, dto.state);
  }

  @Post('tasks/:taskId/transfer')
  @TaskAccess('transfer')
  @HttpCode(200)
  transfer(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string, @Body() dto: TransferTaskDto): Promise<TaskTransfer> {
    return this.tasks.transfer(user, taskId, dto.targetTeamId);
  }

  @Delete('tasks/:taskId')
  @TaskAccess('delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string): Promise<void> {
    await this.tasks.delete(user, taskId);
  }
}
