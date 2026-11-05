import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

/** RN42: os limites contam-se depois de retirar os espaços no início e no fim. */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const NAME_MESSAGE = 'O nome tem de ter entre 3 e 100 caracteres, sem contar os espaços no início e no fim.';
const OBJECTIVE_MESSAGE = 'O objetivo pode ter até 1000 caracteres.';

/** openapi.yaml: ProjectInput (CA01.2, CA01.17). */
export class CreateProjectDto {
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @Length(3, 100, { message: NAME_MESSAGE })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: OBJECTIVE_MESSAGE })
  @MaxLength(1000, { message: OBJECTIVE_MESSAGE })
  objective?: string;
}

/** openapi.yaml: ProjectUpdate (CA01.6, CA01.17). Pelo menos um campo (verificado no controlador). */
export class UpdateProjectDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @Length(3, 100, { message: NAME_MESSAGE })
  name?: string;

  /** Uma cadeia vazia remove o objetivo (fica nulo) — decisão do humano, F12. */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: OBJECTIVE_MESSAGE })
  @MaxLength(1000, { message: OBJECTIVE_MESSAGE })
  objective?: string;
}

/** Parâmetros `q`, `page` e `pageSize` (openapi.yaml; D46). */
export class ListProjectsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'O texto a pesquisar pode ter até 100 caracteres.' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página tem de ser um número inteiro.' })
  @Min(1, { message: 'A página começa em 1.' })
  @Max(100000, { message: 'A página tem de estar entre 1 e 100000.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O tamanho da página tem de ser um número inteiro.' })
  @Min(1, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  @Max(100, { message: 'O tamanho da página tem de estar entre 1 e 100.' })
  pageSize?: number;
}

/** openapi.yaml: ProjectTeamInput (CA01.3). */
export class ProjectTeamInputDto {
  @IsUUID('all', { message: 'A equipa tem de ser um identificador válido.' })
  teamId!: string;
}
