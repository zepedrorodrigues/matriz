import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, createSprint, getProject, getTeamBacklog, listTeamSprints, listTeams, type Sprint } from '@/api/client';
import { leadsTeam, useCurrentUser } from '@/auth/current-user';
import { DatePicker } from '@/components/date-picker';
import { HistoryTimeline } from '@/components/history-timeline';
import { Pager } from '@/components/pager';
import { StateBadge } from '@/components/task-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hoursText } from '@/domain/capacity';
import { SPRINT_STATUS_LABEL, formatDate, validateSprintDates, workingDays } from '@/domain/sprints';
import { cn } from '@/lib/utils';
import { TeamWorkPanel } from './TeamWorkPanel';

const PAGE_SIZE = 20;

/**
 * Ecrã Planeamento da equipa (US04, US07, US08; CA04.1–CA04.3, CA04.8, CA07.1, CA08.1), direção «B · Quadro»
 * (DT17): a equipa escolhe-se no topo e fica no endereço; ao lado, as sprints (criação pelo líder, RN36);
 * no centro, o trabalho da equipa (acompanhamento) e o backlog — tarefas de todos os projetos que não fazem
 * parte da sprint ativa, com as planeadas assinaladas. Consultam os membros da equipa, o administrador e os
 * gestores dos projetos em que a equipa participa (só leitura, F20).
 */
export function TeamPlanningPage() {
  const me = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const allTeams = useQuery({ queryKey: ['teams'], queryFn: listTeams, enabled: me.data?.isAdmin === true });
  // F20: o gestor vê também as equipas dos projetos que gere.
  const managed = useQueries({
    queries: (me.data?.isAdmin ? [] : (me.data?.managedProjectIds ?? [])).map((projectId) => ({
      queryKey: ['project', projectId],
      queryFn: () => getProject(projectId),
    })),
  });
  const own = (me.data?.teams ?? []).map((t) => ({ teamId: t.teamId, teamName: t.teamName }));
  const fromProjects = managed.flatMap((q) => (q.data?.teams ?? []).filter((t) => t.active).map((t) => ({ teamId: t.id, teamName: t.name })));
  const teams = me.data?.isAdmin
    ? (allTeams.data ?? []).filter((t) => t.active).map((t) => ({ teamId: t.id, teamName: t.name }))
    : [...own, ...fromProjects.filter((t, i, all) => !own.some((o) => o.teamId === t.teamId) && all.findIndex((x) => x.teamId === t.teamId) === i)];
  const teamId = params.get('equipa') ?? teams[0]?.teamId ?? '';
  const tab = params.get('vista') === 'backlog' ? 'backlog' : params.get('vista') === 'historico' ? 'history' : 'work';
  const [creating, setCreating] = useState(false);

  const sprints = useQuery({ queryKey: ['sprints', teamId], queryFn: () => listTeamSprints(teamId), enabled: teamId !== '' });

  if (!me.data) return null;
  const mayManage = teamId !== '' && leadsTeam(me.data, teamId);
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    if (key !== 'pagina') next.delete('pagina');
    setParams(next, { replace: key !== 'equipa' });
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-bold">Planeamento da equipa</h1>
          <p className="m-0 text-sm text-muted-foreground">Sprints, trabalho em curso e backlog de cada equipa.</p>
        </div>
        {teams.length > 0 ? (
          <div className="ml-auto flex flex-col gap-1.5">
            <Label htmlFor="team-select">Equipa</Label>
            <Select value={teamId} onValueChange={(v) => setParams(new URLSearchParams({ equipa: v }))}>
              <SelectTrigger id="team-select" className="h-10 min-w-56 bg-card">
                <SelectValue placeholder="Escolher equipa" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <p className="m-0 rounded-xl border bg-card p-6 text-muted-foreground">Não pertence a nenhuma equipa: o planeamento é feito por equipa.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setParam('vista', v === 'backlog' ? 'backlog' : v === 'history' ? 'historico' : null)}
            className="min-w-0 flex-[999_1_560px]"
          >
            <TabsList>
              <TabsTrigger value="work" className="px-4">
                Trabalho da equipa
              </TabsTrigger>
              <TabsTrigger value="backlog" className="px-4">
                Backlog
              </TabsTrigger>
              <TabsTrigger value="history" className="px-4">
                Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="work" className="mt-2 overflow-hidden rounded-xl border bg-card">
              {teamId ? <TeamWorkPanel key={teamId} teamId={teamId} /> : null}
            </TabsContent>
            <TabsContent value="backlog" className="mt-2 overflow-hidden rounded-xl border bg-card">
              <Backlog teamId={teamId} sprints={sprints.data ?? []} page={Math.max(1, Number(params.get('pagina')) || 1)} onPage={(p) => setParam('pagina', String(p))} />
            </TabsContent>
            <TabsContent value="history" className="mt-2">
              {teamId ? <HistoryTimeline key={teamId} element="teams" elementId={teamId} title="Histórico da equipa" /> : null}
            </TabsContent>
          </Tabs>

          <aside aria-labelledby="sprints-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <h2 id="sprints-title" className="m-0 text-sm font-semibold">
                Sprints
              </h2>
              {mayManage ? (
                <Button size="sm" className="ml-auto h-9" onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" /> Nova sprint
                </Button>
              ) : null}
            </div>
            {sprints.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : sprints.isError ? (
              <p className="m-0 text-sm text-destructive">Não foi possível carregar as sprints.</p>
            ) : sprints.data.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">A equipa ainda não tem sprints.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {sprints.data.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/sprints/${s.id}`}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-foreground no-underline hover:border-primary/50 hover:bg-muted/50',
                        s.status === 'active' && 'border-primary/40 bg-accent/60',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatDate(s.startDate)} a {formatDate(s.endDate)}
                        </span>
                        <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="ml-auto rounded-full">
                          {SPRINT_STATUS_LABEL[s.status]}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">{s.workingDays} dias úteis</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {mayManage ? null : <p className="m-0 text-xs text-muted-foreground">Só o líder da equipa cria sprints e planeia tarefas (RN36).</p>}
          </aside>
        </div>
      )}

      {creating ? <NewSprintDialog teamId={teamId} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function Backlog({ teamId, sprints, page, onPage }: { teamId: string; sprints: Sprint[]; page: number; onPage: (p: number) => void }) {
  const backlog = useQuery({
    queryKey: ['backlog', teamId, page],
    queryFn: () => getTeamBacklog(teamId, page, PAGE_SIZE),
    enabled: teamId !== '',
    placeholderData: keepPreviousData,
  });
  const byId = new Map(sprints.map((s) => [s.id, s]));
  if (backlog.isPending) return <Skeleton className="h-64 w-full" />;
  if (backlog.isError) return <p className="m-0 p-4 text-sm text-destructive">Não foi possível carregar o backlog.</p>;
  const b = backlog.data;
  return (
    <div className="flex flex-col">
      <p className="m-0 border-b px-4 py-3 text-xs text-muted-foreground">
        {b.total === 1 ? '1 tarefa' : `${b.total} tarefas`} da equipa, de todos os projetos, que não fazem parte da sprint ativa.
      </p>
      {b.total === 0 ? (
        <p className="m-0 px-4 py-6 text-sm text-muted-foreground">O backlog está vazio.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Tarefa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Estimativa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Sprint</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.items.map((t) => {
                const planned = t.plannedSprintId ? byId.get(t.plannedSprintId) : undefined;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-96 pl-4 whitespace-normal">
                      <Link to={`/tarefas/${t.id}`} className="font-medium text-foreground hover:underline">
                        {t.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {t.projectName}
                        {t.parentTaskId ? ' · Subtarefa' : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={t.state} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.estimateHours === null ? <span className="text-warning">Sem estimativa</span> : hoursText(t.estimateHours)}
                      {t.storyPoints === null ? '' : ` · ${t.storyPoints} SP`}
                    </TableCell>
                    <TableCell>{t.assignee?.name ?? <span className="text-muted-foreground">Sem responsável</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {planned ? (
                        <Link to={`/sprints/${planned.id}`} className="hover:underline">
                          Planeada · {formatDate(planned.startDate)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pager page={b.page} pageSize={b.pageSize} total={b.total} onPage={onPage} />
        </>
      )}
    </div>
  );
}

/** Nova sprint (RN31, RN36): só o líder; datas em pt-PT com os dias úteis calculados. */
function NewSprintDialog({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => createSprint(teamId, { startDate, endDate }),
    onSuccess: async (sprint) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints', teamId] });
      toast.success('Sprint criada.');
      navigate(`/sprints/${sprint.id}`);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    const found = validateSprintDates({ startDate, endDate });
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate();
  };
  return (
    <Dialog open onOpenChange={(o) => (o || create.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nova sprint</DialogTitle>
            <DialogDescription>A data de fim tem de ser igual ou posterior à de início. As tarefas planeiam-se depois, no quadro da sprint.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker label="Início" value={startDate} onChange={setStartDate} error={errors.startDate} />
            <DatePicker
              label="Fim"
              value={endDate}
              onChange={setEndDate}
              error={errors.endDate}
              hint={startDate && endDate && startDate <= endDate ? `${workingDays(startDate, endDate)} dias úteis` : undefined}
            />
          </div>
          {create.error ? (
            <p role="alert" className="m-0 text-sm font-medium text-destructive">
              {create.error instanceof ApiError ? create.error.message : 'Não foi possível criar a sprint.'}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'A criar…' : 'Criar sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
