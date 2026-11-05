import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const NAME_MESSAGE = 'O nome é obrigatório, não pode ter só espaços e tem até 100 caracteres.';
const EMAIL_MESSAGE = 'Indique um e-mail profissional válido.';

/** openapi.yaml: UserCreate (CA01.13, RN35). */
export class CreateUserDto {
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @Length(1, 100, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name!: string;

  @Transform(trim)
  @IsString({ message: EMAIL_MESSAGE })
  @MaxLength(254, { message: EMAIL_MESSAGE })
  @IsEmail({}, { message: EMAIL_MESSAGE })
  workEmail!: string;
}

/** listUsers: pesquisa e paginação (D46). */
export class ListUsersQuery {
  @IsOptional()
  @IsString({ message: 'A pesquisa tem de ser texto.' })
  @MaxLength(100, { message: 'A pesquisa tem até 100 caracteres.' })
  q?: string;

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
