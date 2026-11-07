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
    // Só os projetos não eliminados (RN38) e, para quem não é da equipa (o gestor de um dos seus projetos),
    // só os que vê, nas tarefas e nas contagens (CAT06, decisão 2a, I14). Contado e paginado na base de dados.
    const scope = viewer ? await this.organization.projectScope(viewer, teamId) : null;
    const projects = await this.organization.projectNames(await this.work.projectsOfTeamTasks(teamId));
    const base = { teamId, projectIds: [...projects.keys()].filter((id) => !scope || scope.has(id)) };

    const tally = await this.work.teamTaskCounts(base);
    const counts: Record<WorkGroup, number> = { planned: 0, in_progress: 0, done: 0, blocked: tally.blocked, overdue: tally.overdue };
    for (const [state, n] of Object.entries(tally.byState) as [TaskState, number][]) counts[STAGE[state]] += n;
    const filter = !group
      ? {}
      : group === 'blocked'
        ? { blocked: true as const }
        : group === 'overdue'
          ? { overdue: true as const }
          : { states: (Object.keys(STAGE) as TaskState[]).filter((s) => STAGE[s] === group) };
    const pageItems = await this.work.planningTasks({
      ...base,
      ...filter,
      orderBy: 'attention',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const names = await this.users.namesByIds(pageItems.flatMap((t) => (t.assigneeId ? [t.assigneeId] : [])));
    return {
      page,
      pageSize,
      total: group ? counts[group] : counts.planned + counts.in_progress + counts.done,
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
