import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, addProjectTeam, listTeams, type Project } from '../../api/client';
import { Notice } from '../../components/Notice';
import { usePageFeedback } from '../../components/PageFeedback';
import { SelectField } from '../../components/SelectField';

/**
 * Equipas do projeto (US01; CA01.3–CA01.5; RN23, RN33): quem vê o projeto vê as equipas associadas; o
 * administrador e os gestores do projeto associam equipas ativas. Só se associa (F18). A resposta da API
 * atualiza o projeto, e as equipas novas ficam logo disponíveis para criar tarefas.
 */
export function ProjectTeams({ project, mayManage }: { project: Project; mayManage: boolean }) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState('');
  const [success, setSuccess] = useState<string>();
  const teams = useQuery({ queryKey: ['teams'], queryFn: listTeams, enabled: mayManage });
  const announce = usePageFeedback('teams', () => setSuccess(undefined));

  const add = useMutation({
    mutationFn: (id: string) => addProjectTeam(project.id, id),
    onMutate: () => {
      setSuccess(undefined);
      announce();
    },
    onSuccess: async (updated, id) => {
      queryClient.setQueryData<Project>(['project', project.id], (p) => (p ? { ...p, teams: updated } : p));
      await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      setTeamId('');
      setSuccess(`Equipa «${updated.find((t) => t.id === id)?.name ?? ''}» associada ao projeto.`);
    },
  });

  const associated = project.teams.map((t) => t.id);
  const available = (teams.data ?? []).filter((t) => t.active && !associated.includes(t.id));

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="project-teams-title">
      <h2 id="project-teams-title" className="m-0 text-base font-semibold">Equipas do projeto</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {add.error ? <Notice tone="error">{add.error instanceof ApiError ? add.error.message : 'Não foi possível associar a equipa.'}</Notice> : null}
      {project.teams.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Nenhuma equipa associada. Sem equipas, o projeto não pode receber tarefas.</p>
      ) : (
        <ul>
          {project.teams.map((t) => (
            <li key={t.id}>
              {t.name}
              {t.active ? null : <span className="m-0 text-sm text-muted-foreground"> (desativada)</span>}
            </li>
          ))}
        </ul>
      )}
      {mayManage ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (teamId && !add.isPending) add.mutate(teamId);
          }}
        >
          <SelectField
            label="Associar equipa"
            value={teamId}
            onChange={(v) => {
              add.reset();
              setTeamId(v);
            }}
            hint={teams.isSuccess && available.length === 0 ? 'Todas as equipas ativas já estão associadas.' : undefined}
          >
            <option value="">Escolha a equipa</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!teamId || add.isPending}>
              {add.isPending ? 'A associar…' : 'Associar equipa'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
