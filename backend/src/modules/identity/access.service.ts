import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessRequirement, ProjectAction, TaskAction } from '../../shared/auth/access.decorators';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import {
  DEVELOPMENT_STATES,
  TASK_STATES,
  WORK_ITEM_LOCATOR,
  type TaskLocation,
  type TaskState,
  type WorkItemLocator,
} from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** RN26: o membro move as tarefas que lhe estão atribuídas entre «Pronto a desenvolver» e «Terminada». */
const MEMBER_STATES: readonly TaskState[] = ['ready_for_development', 'in_development', 'in_testing', 'done'];

/**
 * Papel mais abrangente do utilizador sobre uma tarefa (os papéis acumulam-se, §3.1): administrador,
 * gestor do projeto, líder ou membro da equipa responsável, ou apenas quem vê o projeto.
 */
type TaskRole = 'admin' | 'manager' | 'leader' | 'member' | 'viewer' | 'none';
const LEADS_TASK: readonly TaskRole[] = ['admin', 'manager', 'leader'];

/**
 * Avaliação da matriz de permissões (requirements.md §3.1, SEC02), consultando o módulo Organização
 * para os papéis por equipa e por projeto e o módulo Trabalho (pela interface WorkItemLocator) para
 * saber a que projeto e equipa pertence cada elemento.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
  ) {}

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
   * controlador. Identificador mal formado, elemento inexistente ou eliminado → 404 (RN38).
   * O corpo do pedido só é lido quando a regra depende dele (equipa da nova tarefa, prioridade, estado).
   */
  async enforce(
    user: AuthenticatedUser,
    requirement: AccessRequirement,
    params: Record<string, string>,
    body: Record<string, unknown> = {},
  ): Promise<void> {
    switch (requirement.kind) {
      case 'createProject':
        if (!(await this.canCreateProject(user))) {
          throw new ForbiddenException('Só o administrador e os líderes de equipa podem criar projetos.');
        }
        return;
      case 'project':
        return this.enforceProject(user, requirement.action, await this.existingProject(params[requirement.param]), body);
      case 'objective': {
        const objectiveId = params[requirement.param];
        const projectId = isUuid(objectiveId) ? await this.work.projectOfObjective(objectiveId) : null;
        if (!projectId) throw new NotFoundException('O objetivo não existe.');
        return this.enforceProject(user, 'createWork', await this.existingProject(projectId), body);
      }
      case 'task':
        return this.enforceTask(user, requirement.action, await this.existingTask(params[requirement.param]), body);
    }
  }

  private async enforceProject(
    user: AuthenticatedUser,
    action: ProjectAction,
    projectId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    switch (action) {
      case 'view':
        if (!(await this.canViewProject(user, projectId))) throw new ForbiddenException('Não tem acesso a este projeto.');
        return;
      case 'edit':
      case 'delete':
        if (!(await this.canManageProject(user, projectId))) {
          throw new ForbiddenException('Só o administrador e os gestores do projeto podem alterá-lo ou eliminá-lo.');
        }
        return;
      case 'createWork':
        // §3.1: criar objetivos e épicos — administrador, gestor do projeto ou líder de uma equipa do projeto.
        if (
          !(await this.canManageProject(user, projectId)) &&
          !(await this.organization.leadsTeamOnProject(user.id, projectId))
        ) {
          throw new ForbiddenException(
            'Só o administrador, os gestores do projeto e os líderes das suas equipas criam objetivos e épicos.',
          );
        }
        return;
      case 'createTask':
        return this.enforceCreateTask(user, projectId, body);
    }
  }

  /**
   * §3.1, RN21: o administrador e o gestor criam tarefas para qualquer equipa do projeto; o líder e o
   * membro, só para uma equipa a que pertencem. A equipa vem do corpo (`teamId`) ou, numa subtarefa,
   * da tarefa principal (RN22). Se o corpo não a identificar, a validação responde depois (400/422).
   */
  private async enforceCreateTask(user: AuthenticatedUser, projectId: string, body: Record<string, unknown>): Promise<void> {
    if (await this.canManageProject(user, projectId)) return;
    if (!(await this.canViewProject(user, projectId))) throw new ForbiddenException('Não tem acesso a este projeto.');

    let teamId: string | undefined;
    if (isUuid(body.teamId)) teamId = body.teamId;
    else if (isUuid(body.parentTaskId)) {
      const parent = await this.work.locateTask(body.parentTaskId);
      if (parent?.projectId === projectId) teamId = parent.teamId;
    }
    if (teamId && !(await this.organization.teamRole(user.id, teamId))) {
      throw new ForbiddenException('Só pode criar tarefas no backlog de uma equipa a que pertence (RN21).');
    }
  }

  private async enforceTask(
    user: AuthenticatedUser,
    action: TaskAction,
    task: TaskLocation,
    body: Record<string, unknown>,
  ): Promise<void> {
    const role = await this.taskRole(user, task);
    if (role === 'none') throw new ForbiddenException('Não tem acesso a esta tarefa.');

    switch (action) {
      case 'view':
        return;
      case 'edit':
        // D49: editam o título e a descrição o administrador, o gestor do projeto e os membros da equipa responsável.
        if (role === 'viewer') {
          throw new ForbiddenException(
            'Só o administrador, os gestores do projeto e os membros da equipa responsável editam esta tarefa.',
          );
        }
        // RN39: depois de criada, a prioridade só é alterada pelo líder, pelo gestor ou pelo administrador.
        if (body.priority !== undefined && !LEADS_TASK.includes(role)) {
          throw new ForbiddenException(
            'Só o líder da equipa responsável, os gestores do projeto e o administrador alteram a prioridade.',
          );
        }
        // §3.1, RN10 (CA03.10): os membros definem estimativas; depois de «A desenvolver», só o líder,
        // o gestor e o administrador as alteram.
        if (
          (body.estimateHours !== undefined || body.storyPoints !== undefined) &&
          !LEADS_TASK.includes(role) &&
          DEVELOPMENT_STATES.includes(task.state)
        ) {
          throw new ForbiddenException(
            'Depois de a tarefa entrar em «A desenvolver», só o líder da equipa, os gestores do projeto e o administrador alteram as estimativas.',
          );
        }
        return;
      case 'changeState': {
        if (LEADS_TASK.includes(role)) return;
        const target = body.state;
        const knownTarget = typeof target === 'string' && (TASK_STATES as readonly string[]).includes(target);
        // Um estado desconhecido é recusado depois pela validação (400).
        if (!knownTarget) return;
        const mayMove =
          role === 'member' &&
          task.assigneeId === user.id &&
          MEMBER_STATES.includes(task.state) &&
          MEMBER_STATES.includes(target as TaskState);
        if (!mayMove) {
          throw new ForbiddenException(
            'O membro só move as tarefas que lhe estão atribuídas, entre «Pronto a desenvolver» e «Terminada».',
          );
        }
        return;
      }
      case 'createCriterion':
        return this.enforceCriterionText(user, role, task);
      case 'updateCriterion':
        if (body.description !== undefined) this.enforceCriterionText(user, role, task);
        // §3.1: registar o cumprimento — o membro, só nas tarefas que lhe estão atribuídas.
        if (body.isMet !== undefined && !LEADS_TASK.includes(role) && !(role === 'member' && task.assigneeId === user.id)) {
          throw new ForbiddenException(
            'O membro só regista o cumprimento dos critérios das tarefas que lhe estão atribuídas.',
          );
        }
        return;
      case 'delete':
        if (!LEADS_TASK.includes(role)) {
          throw new ForbiddenException(
            'Só o administrador, os gestores do projeto e o líder da equipa responsável eliminam tarefas.',
          );
        }
        return;
    }
  }

  /**
   * RN24 (CA06.7–CA06.9): definem e alteram os critérios o administrador, o gestor do projeto, o líder
   * da equipa responsável e, antes de «A desenvolver», quem criou a tarefa (se ainda pertencer à equipa
   * responsável). Os restantes membros registam apenas o cumprimento.
   */
  private enforceCriterionText(user: AuthenticatedUser, role: TaskRole, task: TaskLocation): void {
    if (LEADS_TASK.includes(role)) return;
    if (DEVELOPMENT_STATES.includes(task.state)) {
      throw new ForbiddenException(
        'Depois de a tarefa entrar em «A desenvolver», só o líder da equipa, os gestores do projeto e o administrador alteram os critérios.',
      );
    }
    if (role !== 'member' || task.createdBy !== user.id) {
      throw new ForbiddenException(
        'Definem os critérios quem criou a tarefa, o líder da equipa, os gestores do projeto e o administrador; os membros registam o cumprimento.',
      );
    }
  }

  private async taskRole(user: AuthenticatedUser, task: TaskLocation): Promise<TaskRole> {
    if (user.isAdmin) return 'admin';
    if (await this.organization.isProjectManager(user.id, task.projectId)) return 'manager';
    const teamRole = await this.organization.teamRole(user.id, task.teamId);
    if (teamRole) return teamRole;
    return (await this.organization.isProjectVisibleToMember(user.id, task.projectId)) ? 'viewer' : 'none';
  }

  private async existingProject(projectId: string | undefined): Promise<string> {
    if (!isUuid(projectId) || !(await this.organization.projectExists(projectId))) {
      throw new NotFoundException('O projeto não existe.');
    }
    return projectId;
  }

  /** Tarefa não eliminada de um projeto não eliminado (RN38); senão 404. */
  private async existingTask(taskId: string | undefined): Promise<TaskLocation> {
    const task = isUuid(taskId) ? await this.work.locateTask(taskId) : null;
    if (!task || !(await this.organization.projectExists(task.projectId))) {
      throw new NotFoundException('A tarefa não existe.');
    }
    return task;
  }
}
