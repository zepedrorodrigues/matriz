import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { TASK_STATES, WORK_ITEM_LOCATOR, type TaskState, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';

/** openapi.yaml: Dashboard */
export interface Dashboard {
  projects: { id: string; name: string; taskCounts: Record<TaskState, number>; totalTasks: number }[];
}

/**
 * Painel inicial (CA07.9, RF36; Ficha PL 03, Ex. 7), no módulo Acompanhamento (architecture.md §5).
 * Não lê tabelas de outros módulos (§6): os projetos visíveis vêm da interface de leitura do módulo
 * Organização e as contagens da interface WorkItemLocator, implementada pelo módulo Trabalho. As
 * contagens abrangem todas as tarefas de topo do projeto (não uma página) e excluem as eliminadas.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
  ) {}

  async forUser(user: AuthenticatedUser): Promise<Dashboard> {
    const projects = await this.organization.visibleProjects(user.id, user.isAdmin);
    const counts = await this.work.taskCountsByProject(projects.map((p) => p.id));
    return {
      projects: projects.map((p) => {
        const found = counts.get(p.id) ?? {};
        const taskCounts = Object.fromEntries(TASK_STATES.map((s) => [s, found[s] ?? 0])) as Record<TaskState, number>;
        return { id: p.id, name: p.name, taskCounts, totalTasks: TASK_STATES.reduce((sum, s) => sum + taskCounts[s], 0) };
      }),
    };
  }
}
