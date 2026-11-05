import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Indique a data no formato AAAA-MM-DD.';

/** openapi.yaml: SprintDates (CA04.1, CA04.12; RN31). A ordem das datas verifica-se no controlador. */
export class SprintDatesDto {
  @Matches(DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  startDate!: string;

  @Matches(DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  endDate!: string;
}

/** openapi.yaml: SprintStart (RN36): datas ajustadas no início, ou omitidas para as confirmar. */
export class SprintStartDto {
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  endDate?: string;
}

/** openapi.yaml: SprintTaskInput (CA04.3, CA04.16). */
export class SprintTaskInputDto {
  @IsUUID('all', { message: 'A tarefa tem de ser um identificador válido.' })
  taskId!: string;
}

/** Paginação do backlog (D46). */
export class BacklogQuery {
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
