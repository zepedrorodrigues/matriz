import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { TASK_STATES, type TaskState } from '../../shared/ports/work-item-locator';

/** RN42: os limites contam-se depois de retirar os espaços no início e no fim. */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

const TITLE_MESSAGE = 'O título tem de ter entre 3 e 150 caracteres, sem contar os espaços no início e no fim.';
const DESCRIPTION_MESSAGE = 'A descrição pode ter até 2000 caracteres.';
const PRIORITY_MESSAGE = 'A prioridade tem de ser low, medium ou high.';
const STATE_MESSAGE = `O estado tem de ser um de: ${TASK_STATES.join(', ')}.`;
const ELEMENT_TITLE_MESSAGE = 'O título é obrigatório e não pode ter só espaços.';

/** openapi.yaml: ElementInput — objetivo ou épico (CA02.1, CA02.2). */
export class ElementInputDto {
  @Transform(trim)
  @IsString({ message: ELEMENT_TITLE_MESSAGE })
  @Matches(/\S/, { message: ELEMENT_TITLE_MESSAGE })
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A descrição tem de ser texto.' })
  description?: string;
}

/**
 * openapi.yaml: TaskCreate (CA03.1, CA03.11, CA03.18, RN12, RN22, RN29). A combinação épico e equipa
 * (tarefa) ou tarefa principal (subtarefa) é verificada no controlador. O responsável pela execução,
 * as estimativas e o prazo chegam nos incrementos I5 e I6; até lá, são campos desconhecidos (400).
 */
export class CreateTaskDto {
  @IsOptional()
  @IsUUID('all', { message: 'O épico tem de ser um identificador válido.' })
  epicId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'A tarefa principal tem de ser um identificador válido.' })
  parentTaskId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'A equipa tem de ser um identificador válido.' })
  teamId?: string;

  @Transform(trim)
  @IsString({ message: TITLE_MESSAGE })
  @Length(3, 150, { message: TITLE_MESSAGE })
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: DESCRIPTION_MESSAGE })
  @MaxLength(2000, { message: DESCRIPTION_MESSAGE })
  description?: string;

  @IsOptional()
  @IsIn(PRIORITIES, { message: PRIORITY_MESSAGE })
  priority?: Priority;
}

/**
 * openapi.yaml: TaskUpdate — no I4, título, descrição e prioridade (CA03.12, CA03.18). A descrição a
 * `null` ou vazia fica sem valor. O título e a prioridade não aceitam `null`.
 */
export class UpdateTaskDto {
  @ValidateIf((o: UpdateTaskDto) => o.title !== undefined)
  @Transform(trim)
  @IsString({ message: TITLE_MESSAGE })
  @Length(3, 150, { message: TITLE_MESSAGE })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: DESCRIPTION_MESSAGE })
  @MaxLength(2000, { message: DESCRIPTION_MESSAGE })
  description?: string | null;

  @ValidateIf((o: UpdateTaskDto) => o.priority !== undefined)
  @IsIn(PRIORITIES, { message: PRIORITY_MESSAGE })
  priority?: Priority;
}

/** openapi.yaml: StateChange (RN26). */
export class StateChangeDto {
  @IsIn(TASK_STATES, { message: STATE_MESSAGE })
  state!: TaskState;
}

/** Filtros e paginação da listagem de tarefas (CA03.19, D46). */
export class ListTasksQuery {
  @IsOptional()
  @IsIn(TASK_STATES, { message: STATE_MESSAGE })
  state?: TaskState;

  @IsOptional()
  @IsIn(PRIORITIES, { message: PRIORITY_MESSAGE })
  priority?: Priority;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página tem de ser um número inteiro.' })
  @Min(1, { message: 'A página começa em 1.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O tamanho da página tem de ser um número inteiro.' })
  @Min(1, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  @Max(100, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  pageSize?: number;
}
