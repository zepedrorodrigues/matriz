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
    <section className="page">
      <div className="page__header">
        <h1>Projetos</h1>
        {mayCreate && !creating ? (
          <button type="button" onClick={() => setCreating(true)}>
            Novo projeto
          </button>
        ) : null}
      </div>

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      {creating ? (
        <div className="panel">
          <h2>Novo projeto</h2>
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

      <form className="search" role="search" onSubmit={search}>
        <label htmlFor="project-search">Pesquisar pelo nome</label>
        <input id="project-search" type="search" value={searchText} maxLength={100} onChange={(e) => setSearchText(e.target.value)} />
        <button type="submit" className="button--secondary">
          Pesquisar
        </button>
        {q ? (
          <button
            type="button"
            className="button--link"
            onClick={() => {
              setSearchText('');
              setParams(new URLSearchParams());
            }}
          >
            Limpar pesquisa
          </button>
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
          <p className="muted" aria-live="polite">
            {projects.data.total === 1 ? '1 projeto' : `${projects.data.total} projetos`}
            {q ? ` para «${q}»` : ''}
          </p>
          <ul className="card-list">
            {projects.data.items.map((p) => (
              <li key={p.id} className="card">
                <Link to={`/projetos/${p.id}`} className="card__title">
                  {p.name}
                </Link>
                <p className="card__text">{p.objective ?? <span className="muted">Sem objetivo definido.</span>}</p>
              </li>
            ))}
          </ul>
          <Pagination page={projects.data.page} pageSize={projects.data.pageSize} total={projects.data.total} onPage={goToPage} />
        </>
      )}
    </section>
  );
}
