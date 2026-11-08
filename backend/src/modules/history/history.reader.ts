import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../../shared/auth/auth.decorators';
import { SYSTEM_AUTHOR_ID } from '../../shared/events/domain-events';
import { SPRINT_LOCATOR, type SprintLocator } from '../../shared/ports/sprint-locator';
import { USER_DIRECTORY, type UserDirectory } from '../../shared/ports/user-directory';
import { WORK_ITEM_LOCATOR, type WorkItemLocator } from '../../shared/ports/work-item-locator';
import { OrganizationReader } from '../organization/organization-reader.service';

/** Elementos com histórico consultável (D50); os critérios aparecem no histórico da sua tarefa. */
export type HistoryElement = 'project' | 'objective' | 'epic' | 'task' | 'sprint' | 'team';

/** Evento do histórico tal como o contrato o descreve (`HistoryEvent`, openapi.yaml). */
export interface HistoryEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  author: { id: string; name: string };
  occurredAt: string;
  references: Record<string, string>;
  omitted: string[];
}

export interface HistoryPage {
  page: number;
  pageSize: number;
  total: number;
  items: HistoryEvent[];
}

interface EventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  author_id: string;
  occurred_at: Date;
  omitted?: string[];
}

/** SEC07, CAT05: dados individuais de capacidade nos eventos da equipa e da sprint. */
const CAPACITY_FIELDS = ['allocationPct', 'availableHours'];
/** CAT06: uma tarefa que não se vê sai do evento com os dados dela (decisão do humano, passo 2). */
const TASK_FIELDS = ['taskId', 'estimateHours', 'storyPoints'];
const TASK_LISTS = ['taskIds', 'returnedToBacklog'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Origens do histórico de uma tarefa (CAT03, D50 e decisão (a) do passo 2): os seus eventos, os dos seus
 * critérios e os das sprints em que entrou ou de que saiu — incluindo a devolução ao backlog no fim da
 * sprint (`closed`). Depende da forma do `newValue` publicada pelos módulos Trabalho e Planeamento
 * (`taskId`, `returnedToBacklog`); os testes por origem falham se um desses campos mudar de nome.
 */
const TASK_SOURCES = `(entity_type = 'task' AND entity_id = $1::uuid)
  OR (entity_type IN ('acceptance_criterion', 'sprint') AND new_value->>'taskId' = $1::text)
  OR (entity_type = 'sprint' AND event_type = 'closed' AND new_value->'returnedToBacklog' @> jsonb_build_array($1::text))`;

/**
 * Leitura do histórico (RN32): só SELECT, por ordem de registo (`id`), paginada como os comentários (D46).
 * Os valores guardam identificadores; os nomes de pessoas, equipas e tarefas vêm em `references`, pelas
 * interfaces de leitura dos módulos donos (architecture.md §6), sem ler as tabelas deles.
 */
@Injectable()
export class HistoryReader {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(WORK_ITEM_LOCATOR) private readonly work: WorkItemLocator,
    @Inject(SPRINT_LOCATOR) private readonly sprints: SprintLocator,
    private readonly organization: OrganizationReader,
  ) {}

  /** Quem pode consultar já foi verificado pelo guarda (D50, §3.1); aqui retira-se o que `viewer` não vê. */
  async list(element: HistoryElement, id: string, page: number, pageSize: number, viewer: AuthenticatedUser): Promise<HistoryPage> {
    const where = element === 'task' ? TASK_SOURCES : `entity_type = $2::history.entity_type AND entity_id = $1`;
    const params = element === 'task' ? [id] : [id, element];
    const [{ total }] = await this.db.query(`SELECT count(*)::int AS total FROM history.history_event WHERE ${where}`, params);
    const rows: EventRow[] = await this.db.query(
      `SELECT id, entity_type, entity_id, event_type, old_value, new_value, author_id, occurred_at
       FROM history.history_event WHERE ${where}
       ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    if (element === 'task') for (const row of rows) onlyThisTask(row, id);
    if (element === 'team' || element === 'sprint') {
      const teamId = element === 'team' ? id : await this.sprints.teamOfSprint(id);
      if (teamId) await this.redact(rows, viewer, teamId);
    }
    return { page, pageSize, total, items: await this.toEvents(rows) };
  }

  private async toEvents(rows: EventRow[]): Promise<HistoryEvent[]> {
    const refs = [...new Set(rows.flatMap((r) => [...uuidsIn(r.old_value), ...uuidsIn(r.new_value)]))];
    const [people, teams, tasks] = await Promise.all([
      this.users.namesByIds([...new Set([...refs, ...rows.map((r) => r.author_id)])]),
      this.organization.teamNames(refs),
      this.work.planningTasks({ taskIds: refs }),
    ]);
    const names = new Map<string, string>([...people]);
    for (const [teamId, team] of teams) names.set(teamId, team.name);
    for (const task of tasks) names.set(task.id, task.title);
    return rows.map((r) => {
      const ids = new Set([...uuidsIn(r.old_value), ...uuidsIn(r.new_value)]);
      return {
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        eventType: r.event_type,
        oldValue: r.old_value,
        newValue: r.new_value,
        author: { id: r.author_id, name: r.author_id === SYSTEM_AUTHOR_ID ? 'Sistema' : (names.get(r.author_id) ?? '') },
        occurredAt: r.occurred_at.toISOString(),
        references: Object.fromEntries([...ids].filter((i) => names.has(i)).map((i) => [i, names.get(i)!])),
        omitted: r.omitted ?? [],
      };
    });
  }

  /**
   * D50 (§3.1) nos históricos da equipa e da sprint: o evento fica, sem o que quem consulta não pode ver.
   * SEC07 — capacidade individual: o administrador e o líder veem todas, o membro só a sua, o gestor nenhuma.
   * CAT06 — tarefas referidas: só as dos projetos que vê, com a regra das vistas da equipa (`projectScope`).
   */
  private async redact(rows: EventRow[], viewer: AuthenticatedUser, teamId: string): Promise<void> {
    const role = viewer.isAdmin ? 'leader' : await this.organization.teamRole(viewer.id, teamId);
    const scope = await this.organization.projectScope(viewer, teamId);
    let visible: Set<string> | null = null;
    if (scope) {
      const refs = [...new Set(rows.flatMap((r) => [...uuidsIn(r.old_value), ...uuidsIn(r.new_value)]))];
      const tasks = await this.work.planningTasks({ taskIds: refs });
      visible = new Set(tasks.filter((task) => scope.has(task.projectId)).map((task) => task.id));
    }
    for (const row of rows) {
      const omitted = new Set<string>();
      const strip = (value: Record<string, unknown> | null): Record<string, unknown> | null => {
        if (!value) return value;
        const out = { ...value };
        const remove = (field: string) => {
          if (field in out) {
            delete out[field];
            omitted.add(field);
          }
        };
        if (role !== 'leader' && !(role === 'member' && out.userId === viewer.id)) CAPACITY_FIELDS.forEach(remove);
        if (visible) {
          if (typeof out.taskId === 'string' && !visible.has(out.taskId)) TASK_FIELDS.forEach(remove);
          for (const field of TASK_LISTS) {
            const list = out[field];
            if (!Array.isArray(list)) continue;
            const kept = list.filter((taskId) => visible.has(taskId as string));
            if (kept.length < list.length) {
              out[field] = kept;
              omitted.add(field);
            }
          }
        }
        return out;
      };
      row.old_value = strip(row.old_value);
      row.new_value = strip(row.new_value);
      row.omitted = [...omitted];
    }
  }
}

/** Identificadores referidos num valor: campos de primeiro nível com um UUID ou uma lista deles. */
function uuidsIn(value: Record<string, unknown> | null): string[] {
  if (!value) return [];
  return Object.values(value).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is string => typeof v === 'string' && UUID.test(v));
}

/** No histórico de uma tarefa, o fim da sprint mostra só a devolução dessa tarefa ao backlog (decisão (a)). */
function onlyThisTask(row: EventRow, taskId: string): void {
  if (row.entity_type === 'sprint' && Array.isArray(row.new_value?.returnedToBacklog)) {
    row.new_value = { ...row.new_value, returnedToBacklog: [taskId] };
  }
}
