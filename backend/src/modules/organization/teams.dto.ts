import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import type { TeamRole } from './organization.entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const NAME_MESSAGE = 'O nome da equipa é obrigatório, não pode ter só espaços e tem até 100 caracteres.';
const ALLOCATION_MESSAGE = 'A alocação é um número inteiro de 1 a 100 (%).';
const TEAM_MESSAGE = 'A equipa tem de ser um identificador válido.';

class Allocation {
  @IsInt({ message: ALLOCATION_MESSAGE })
  @Min(1, { message: ALLOCATION_MESSAGE })
  @Max(100, { message: ALLOCATION_MESSAGE })
  allocationPct!: number;
}

export class OtherAllocationDto extends Allocation {
  @IsUUID('all', { message: TEAM_MESSAGE })
  teamId!: string;
}

/** openapi.yaml: TeamCreate (CA01.1, RN33, RN34; F18). */
export class CreateTeamDto {
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @Length(1, 100, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name!: string;

  @IsUUID('all', { message: 'O líder tem de ser um identificador válido.' })
  leaderId!: string;

  @IsInt({ message: ALLOCATION_MESSAGE })
  @Min(1, { message: ALLOCATION_MESSAGE })
  @Max(100, { message: ALLOCATION_MESSAGE })
  leaderAllocationPct!: number;

  @IsArray({ message: 'Indique as alocações do líder nas outras equipas (lista, possivelmente vazia).' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OtherAllocationDto)
  leaderOtherAllocations!: OtherAllocationDto[];
}

/** openapi.yaml: TeamUpdate (CA01.7). */
export class UpdateTeamDto {
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @Length(1, 100, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name!: string;
}

export class MembershipDto extends OtherAllocationDto {
  @IsIn(['leader', 'member'], { message: 'O papel tem de ser leader ou member.' })
  role!: TeamRole;
}

/** openapi.yaml: MembershipsInput (CA01.9, RN06; F18). */
export class MembershipsInputDto {
  @IsArray({ message: 'Indique a lista completa das pertenças (possivelmente vazia).' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MembershipDto)
  memberships!: MembershipDto[];
}
