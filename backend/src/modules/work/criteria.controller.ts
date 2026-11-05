import { Body, Controller, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { TaskAccess } from '../../shared/auth/access.decorators';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { ValidationFailedException } from '../../shared/errors/problem-details.filter';
import { CriteriaService } from './criteria.service';
import type { AcceptanceCriterion } from './criteria.service';
import { CriterionInputDto, CriterionUpdateDto } from './work.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * openapi.yaml: createAcceptanceCriterion, updateAcceptanceCriterion. A autorização é declarada em cada
 * rota e verificada pelo guarda global (RN24, §3.1); a do PATCH depende dos campos enviados.
 */
@Controller('tasks/:taskId/acceptance-criteria')
export class CriteriaController {
  constructor(private readonly criteria: CriteriaService) {}

  @Post()
  @TaskAccess('createCriterion')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: CriterionInputDto,
  ): Promise<AcceptanceCriterion> {
    return this.criteria.create(user, taskId, dto.description);
  }

  @Patch(':criterionId')
  @TaskAccess('updateCriterion')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Param('criterionId') criterionId: string,
    @Body() dto: CriterionUpdateDto,
  ): Promise<AcceptanceCriterion> {
    if (dto.description === undefined && dto.isMet === undefined) {
      throw new ValidationFailedException([{ field: '', message: 'Indique a descrição ou o cumprimento (isMet).' }]);
    }
    if (!UUID.test(criterionId)) {
      // Identificador mal formado: o mesmo que um critério inexistente (404), sem chegar à base.
      throw new NotFoundException('O critério de aceitação não existe nesta tarefa.');
    }
    return this.criteria.update(user, taskId, criterionId, dto);
  }
}
