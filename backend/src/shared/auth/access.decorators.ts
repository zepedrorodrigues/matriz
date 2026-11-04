import { SetMetadata } from '@nestjs/common';

/**
 * Permissão exigida por uma rota, avaliada pelo guarda global do módulo Identidade e acesso segundo
 * a matriz de permissões (requirements.md §3.1, SEC02). Os módulos declaram a permissão sem
 * dependerem do módulo Identidade (architecture.md §6).
 */
export type AccessRequirement =
  | { kind: 'createProject' }
  | { kind: 'project'; action: 'view' | 'edit' | 'delete'; param: string };

export const ACCESS_REQUIREMENT = 'matriz:accessRequirement';

/** Criar projetos: administrador ou líder de equipa (RN25, D48). */
export const CanCreateProject = () => SetMetadata(ACCESS_REQUIREMENT, { kind: 'createProject' } satisfies AccessRequirement);

/**
 * Operação sobre o projeto indicado no parâmetro de rota. Projeto inexistente, eliminado (RN38) ou
 * com identificador mal formado → 404; existente mas sem permissão → 403.
 */
export const ProjectAccess = (action: 'view' | 'edit' | 'delete', param = 'projectId') =>
  SetMetadata(ACCESS_REQUIREMENT, { kind: 'project', action, param } satisfies AccessRequirement);
