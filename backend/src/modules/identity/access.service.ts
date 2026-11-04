import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessRequirement } from '../../shared/auth/access.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { OrganizationReader } from '../organization/organization-reader.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Avaliação da matriz de permissões (requirements.md §3.1, SEC02), consultando o módulo
 * Organização para os papéis por equipa e por projeto. Os incrementos seguintes acrescentam aqui
 * as operações sobre tarefas, comentários e atribuições.
 */
@Injectable()
export class AccessService {
  constructor(private readonly organization: OrganizationReader) {}

  /**
   * §3.1 Visibilidade (CAT06): o administrador vê todos os projetos; os restantes, os projetos em que
   * participa uma das suas equipas e aqueles de que são gestores.
   */
  async canViewProject(user: AuthenticatedUser, projectId: string): Promise<boolean> {
    if (user.isAdmin) return true;
    return this.organization.isProjectVisibleToMember(user.id, projectId);
  }

  /** §3.1: editar e eliminar projetos — administrador ou gestor do projeto (CA01.6, CA01.15, CA01.16). */
  async canManageProject(user: AuthenticatedUser, projectId: string): Promise<boolean> {
    if (user.isAdmin) return true;
    return this.organization.isProjectManager(user.id, projectId);
  }

  /** RN25, D48: criar projetos — administrador ou líder de uma equipa ativa. */
  async canCreateProject(user: AuthenticatedUser): Promise<boolean> {
    if (user.isAdmin) return true;
    return this.organization.leadsAnActiveTeam(user.id);
  }

  /**
   * Aplica a permissão declarada numa rota. Recusa sem alterar dados (SEC02): o guarda corre antes do
   * controlador. Identificador mal formado, projeto inexistente ou eliminado → 404 (RN38).
   */
  async enforce(user: AuthenticatedUser, requirement: AccessRequirement, params: Record<string, string>): Promise<void> {
    if (requirement.kind === 'createProject') {
      if (!(await this.canCreateProject(user))) {
        throw new ForbiddenException('Só o administrador e os líderes de equipa podem criar projetos.');
      }
      return;
    }
    const projectId = params[requirement.param];
    if (!projectId || !UUID.test(projectId) || !(await this.organization.projectExists(projectId))) {
      throw new NotFoundException('O projeto não existe.');
    }
    const allowed =
      requirement.action === 'view'
        ? await this.canViewProject(user, projectId)
        : await this.canManageProject(user, projectId);
    if (!allowed) {
      throw new ForbiddenException(
        requirement.action === 'view'
          ? 'Não tem acesso a este projeto.'
          : 'Só o administrador e os gestores do projeto podem alterá-lo ou eliminá-lo.',
      );
    }
  }
}
