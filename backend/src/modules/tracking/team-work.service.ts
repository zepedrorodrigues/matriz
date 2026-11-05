import { Inject, Injectable } from '@nestjs/common';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { WORK_ITEM_LOCATOR, type PlanningTaskInfo, type TaskState, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';

export type WorkGroup = 'planned' | 'in_progress' | 'done' | 'blocked' | 'overdue';

export interface TeamWork {
  page: number;
  pageSize: number;
  total: number;
  counts: Record<WorkGroup, number>;
  items: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    parentTaskId: string | null;
    state: TaskState;
    priority: PlanningTaskInfo['priority'];
    assignee: { id: string; name: string } | null;
    dueDate: string | null;
    isOverdue: boolean;
    isBlocked: boolean;
    blockReason: string | null;
  }[];
}

/** CA07.1: planeadas, em execução e concluídas, pelos estados de RN17. */
const STAGE: Record<TaskState, 'planned' | 'in_progress' | 'done'> = {
  in_planning: 'planned',
  in_technical_analysis: 'planned',
  ready_for_development: 'planned',
  in_development: 'in_progress',
  in_testing: 'in_progress',
  done: 'done',
  delivered: 'done',
};

/**
 * Vista de trabalho de uma equipa (US07; CA07.1, CA07.3, CA07.4; RF26, RF28, RN28), no módulo
 * Acompanhamento. As tarefas vêm do módulo Trabalho (interface WorkItemLocator), os projetos do módulo
 * Organização e os nomes do módulo Identidade; nenhuma tabela é lida diretamente (architecture.md §6).
 * As contagens são sempre do conjunto completo; `group` filtra só a lista (D46).
 */
@Injectable()
export class TeamWorkService {
  constructor(
    private readonly organization: OrganizationReader,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async forTeam(
    teamId: string,
    group: WorkGroup | undefined,
    page: number,
    pageSize: number,
    viewer?: { id: string; isAdmin: boolean },
  ): Promise<TeamWork> {
    const infos = await this.work.planningTasks({ teamId });
    const projects = await this.organization.projectNames([...new Set(infos.map((t) => t.projectId))]);
    // CAT06, decisão 2a (I14): quem não é da equipa (o gestor de um dos seus projetos) vê só as tarefas e as
    // contagens dos projetos que vê.
    const scope = viewer ? await this.organization.projectScope(viewer, teamId) : null;
    const live = infos.filter((t) => projects.has(t.projectId) && (!scope || scope.has(t.projectId)));
    const counts: Record<WorkGroup, number> = { planned: 0, in_progress: 0, done: 0, blocked: 0, overdue: 0 };
    for (const t of live) {
      counts[STAGE[t.state]]++;
      if (t.isBlocked) counts.blocked++;
      if (t.isOverdue) counts.overdue++;
    }
    const matches = (t: PlanningTaskInfo) =>
      !group || (group === 'blocked' ? t.isBlocked : group === 'overdue' ? t.isOverdue : STAGE[t.state] === group);
    // Bloqueadas primeiro, depois as atrasadas; dentro de cada grupo, as mais recentes primeiro.
    const rank = (t: PlanningTaskInfo) => (t.isBlocked ? 0 : t.isOverdue ? 1 : 2);
    const selected = live.filter(matches).sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
    const pageItems = selected.slice((page - 1) * pageSize, page * pageSize);
    const names = await this.users.namesByIds(pageItems.flatMap((t) => (t.assigneeId ? [t.assigneeId] : [])));
    return {
      page,
      pageSize,
      total: selected.length,
      counts,
      items: pageItems.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: projects.get(t.projectId)!,
        parentTaskId: t.parentTaskId,
        state: t.state,
        priority: t.priority,
        assignee: t.assigneeId ? { id: t.assigneeId, name: names.get(t.assigneeId) ?? '' } : null,
        dueDate: t.dueDate,
        isOverdue: t.isOverdue,
        isBlocked: t.isBlocked,
        blockReason: t.blockReason,
      })),
    };
  }
}
