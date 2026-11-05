import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
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
const CRITERION_MESSAGE = 'A descrição do critério é obrigatória e não pode ter só espaços.';
const USER_ID_MESSAGE = 'O utilizador tem de ser um identificador válido.';
const JUSTIFICATION_MESSAGE = 'A justificação não pode ter só espaços.';

/** RN07: escala comum e fixa de story points. */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;
const STORY_POINTS_MESSAGE = `Os story points têm de ser um de: ${STORY_POINTS.join(', ')}.`;
/** Limite da coluna numeric(6,2): de 0 a 9999,99 horas, com até duas casas decimais. */
export const MAX_ESTIMATE_HOURS = 9999.99;
const HOURS_MESSAGE = 'A estimativa temporal tem de ser um número de horas entre 0 e 9999,99, com até duas casas decimais.';

/**
 * Estimativas independentes (CA03.4, CA03.9, RN07). `null`, na edição, deixa a tarefa sem valor;
 * na criação, equivale a omitir o campo.
 */
function EstimateHours(): PropertyDecorator {
  return (target, key) => {
    IsOptional()(target, key);
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }, { message: HOURS_MESSAGE })(target, key);
    Min(0, { message: HOURS_MESSAGE })(target, key);
    Max(MAX_ESTIMATE_HOURS, { message: HOURS_MESSAGE })(target, key);
  };
}
function StoryPoints(): PropertyDecorator {
  return (target, key) => {
    IsOptional()(target, key);
    IsIn(STORY_POINTS, { message: STORY_POINTS_MESSAGE })(target, key);
  };
}

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
 * (tarefa) ou tarefa principal (subtarefa) é verificada no controlador. Estimativas (I5, CA03.4) e
 * responsável pela execução (I6): na criação, só um membro da equipa responsável (decisão 4a, F15).
 * O prazo chega no I11 — até lá, é um campo desconhecido (400).
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

  @EstimateHours()
  estimateHours?: number | null;

  @StoryPoints()
  storyPoints?: number | null;

  @IsOptional()
  @IsUUID('all', { message: USER_ID_MESSAGE })
  assigneeId?: string;
}

/**
 * openapi.yaml: TaskUpdate — título, descrição e prioridade (I4) e estimativas (I5, CA03.5, CA03.10); CA03.12, CA03.18. A descrição a `null` ou vazia e as
 * estimativas a `null` ficam sem valor. O título e a prioridade não aceitam `null`.
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

  @EstimateHours()
  estimateHours?: number | null;

  @StoryPoints()
  storyPoints?: number | null;

  /** CA03.3, CA09.1: `null` retira o responsável pela execução. */
  @IsOptional()
  @IsUUID('all', { message: USER_ID_MESSAGE })
  assigneeId?: string | null;

  /** RN03, CA09.6: obrigatória quando o responsável é de outra equipa (verificado pelo guarda). */
  @ValidateIf((o: UpdateTaskDto) => o.assignmentJustification !== undefined)
  @Transform(trim)
  @IsString({ message: JUSTIFICATION_MESSAGE })
  @Matches(/\S/, { message: JUSTIFICATION_MESSAGE })
  assignmentJustification?: string;
}

/** openapi.yaml: ParticipantInput (CA03.13, CA03.15; RN03). */
export class ParticipantInputDto {
  @IsUUID('all', { message: USER_ID_MESSAGE })
  userId!: string;

  @ValidateIf((o: ParticipantInputDto) => o.justification !== undefined)
  @Transform(trim)
  @IsString({ message: JUSTIFICATION_MESSAGE })
  @Matches(/\S/, { message: JUSTIFICATION_MESSAGE })
  justification?: string;
}

/** listEligibleUsers: `team` (por omissão) ou `all` (RN03, RN40). */
export class EligibleQuery {
  @IsOptional()
  @IsIn(['team', 'all'], { message: 'O âmbito tem de ser team ou all.' })
  scope?: 'team' | 'all';
}

/** Paginação da listagem de comentários (CA10.2, D46). */
export class ListCommentsQuery {
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

/** openapi.yaml: AcceptanceCriterionInput (CA06.7). */
export class CriterionInputDto {
  @Transform(trim)
  @IsString({ message: CRITERION_MESSAGE })
  @Matches(/\S/, { message: CRITERION_MESSAGE })
  description!: string;
}

/** openapi.yaml: AcceptanceCriterionUpdate — o texto (RN24) e/ou o cumprimento (RN13). */
export class CriterionUpdateDto {
  @ValidateIf((o: CriterionUpdateDto) => o.description !== undefined)
  @Transform(trim)
  @IsString({ message: CRITERION_MESSAGE })
  @Matches(/\S/, { message: CRITERION_MESSAGE })
  description?: string;

  @ValidateIf((o: CriterionUpdateDto) => o.isMet !== undefined)
  @IsBoolean({ message: 'O cumprimento (isMet) tem de ser verdadeiro ou falso.' })
  isMet?: boolean;
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
