import { Button } from '@/components/ui/button';
import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { createProject, listProjects } from '../../api/client';
import { canCreateProject, useCurrentUser } from '../../auth/current-user';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { ProjectForm } from './ProjectForm';

const PAGE_SIZE = 20;

/**
 * Ecrã Projetos (Ficha PL 03, Ex. 4 e Ex. 7): listagem dos projetos visíveis, pesquisa pelo nome,
 * paginação e criação. A pesquisa e a página ficam no endereço, para sobreviverem a recarregar.
 */
export function ProjectsPage() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [searchText, setSearchText] = useState(q);
  const [creating, setCreating] = useState(false);
  const flash = (location.state as { notice?: string } | null)?.notice;

  const projects = useQuery({
    queryKey: ['projects', { q, page }],
    queryFn: () => listProjects({ q: q || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      // A resposta confirmada pela API é a fonte: listagens e permissões são recarregadas.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      queryClient.setQueryData(['project', project.id], project);
      navigate(`/projetos/${project.id}`, { state: { notice: 'Projeto criado.' } });
    },
  });

  const search = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (searchText.trim()) next.set('q', searchText.trim());
    setParams(next);
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  const mayCreate = me.data ? canCreateProject(me.data) : false;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-[22px] font-bold">Projetos</h1>
        {mayCreate && !creating ? (
          <Button type="button" onClick={() => setCreating(true)}>
            Novo projeto
          </Button>
        ) : null}
      </div>

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      {creating ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 className="m-0 text-base font-semibold">Novo projeto</h2>
          <ProjectForm
            submitLabel="Criar projeto"
            busyLabel="A criar…"
            busy={create.isPending}
            error={create.error}
            onSubmit={(input) => create.mutate(input)}
            onCancel={() => {
              create.reset();
              setCreating(false);
            }}
          />
        </div>
      ) : null}

      <form className="flex flex-wrap items-end gap-2 [&>*:first-child]:min-w-64 [&>*:first-child]:flex-1" role="search" onSubmit={search}>
        <label htmlFor="project-search">Pesquisar pelo nome</label>
        <input id="project-search" type="search" value={searchText} maxLength={100} onChange={(e) => setSearchText(e.target.value)} />
        <Button variant="outline" type="submit">
          Pesquisar
        </Button>
        {q ? (
          <Button variant="link" className="h-auto self-start p-0"
            type="button"
            onClick={() => {
              setSearchText('');
              setParams(new URLSearchParams());
            }}
          >
            Limpar pesquisa
          </Button>
        ) : null}
      </form>

      {projects.isPending ? (
        <Notice>A carregar os projetos…</Notice>
      ) : projects.isError ? (
        <Notice tone="error">Não foi possível carregar os projetos. Tente novamente mais tarde.</Notice>
      ) : projects.data.total === 0 ? (
        <Notice>{q ? `Nenhum projeto corresponde a «${q}».` : 'Ainda não tem projetos visíveis.'}</Notice>
      ) : (
        <>
          <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
            {projects.data.total === 1 ? '1 projeto' : `${projects.data.total} projetos`}
            {q ? ` para «${q}»` : ''}
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {projects.data.items.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
                <Link to={`/projetos/${p.id}`} className="font-semibold text-foreground hover:underline">
                  {p.name}
                </Link>
                <p className="m-0 text-sm text-foreground/80">{p.objective ?? <span className="m-0 text-sm text-muted-foreground">Sem objetivo definido.</span>}</p>
              </li>
            ))}
          </ul>
          <Pagination page={projects.data.page} pageSize={projects.data.pageSize} total={projects.data.total} onPage={goToPage} />
        </>
      )}
    </section>
  );
}
