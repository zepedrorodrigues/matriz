import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { OrganizationReader } from '../organization/organization-reader.service';

/**
 * Avaliação da matriz de permissões (requirements.md §3.1, SEC02), consultando o módulo
 * Organização para os papéis por equipa e por projeto. Os incrementos seguintes acrescentam aqui
 * as operações sobre projetos, tarefas, comentários e atribuições.
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
}
