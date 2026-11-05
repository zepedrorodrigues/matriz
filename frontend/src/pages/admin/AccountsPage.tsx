import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ApiError, createUser, listUsers } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { accountStatus, validateAccount } from '../../domain/accounts';
import { AdminNav } from './AdminNav';

const PAGE_SIZE = 20;
const FIELDS = ['name', 'workEmail'];

/**
 * Ecrã Administração › Contas (US01, CA01.13, RN35): pesquisa, paginação e criação de contas pelo
 * administrador. A conta fica «por ligar» até ao primeiro acesso do colaborador, que a liga à sua
 * identidade pelo e-mail profissional. Nenhuma palavra-passe passa pela Matriz (DT04).
 */
export function AccountsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [searchText, setSearchText] = useState(q);
  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string>();

  const accounts = useQuery({
    queryKey: ['users', { q, page }],
    queryFn: () => listUsers({ q: q || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: createUser,
    onMutate: () => setNotice(undefined),
    onSuccess: async (account) => {
      setName('');
      setWorkEmail('');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setNotice(`Conta de ${account.name} criada. Fica ligada no primeiro acesso, com ${account.workEmail}.`);
    },
  });

  const serverErrors = create.error instanceof ApiError && create.error.status === 400 ? create.error.fieldErrors() : {};
  const errors = { ...serverErrors, ...clientErrors };
  const generalError =
    create.error && !(create.error instanceof ApiError && create.error.status === 400 && Object.keys(serverErrors).some((k) => FIELDS.includes(k)))
      ? create.error instanceof ApiError
        ? create.error.message
        : 'Não foi possível criar a conta. Tente novamente.'
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    const found = validateAccount({ name, workEmail });
    setClientErrors(found);
    if (Object.keys(found).length === 0) create.mutate({ name: name.trim(), workEmail: workEmail.trim() });
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (searchText.trim()) next.set('q', searchText.trim());
    setParams(next);
  };

  return (
    <section className="page">
      <AdminNav />
      <h1>Contas de utilizador</h1>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <form className="panel form" onSubmit={submit} noValidate>
        <h2>Nova conta</h2>
        {generalError ? <Notice tone="error">{generalError}</Notice> : null}
        <div className="form__row">
          <FormField label="Nome" value={name} onChange={setName} error={errors.name} maxLength={100} required />
          <FormField
            label="E-mail profissional"
            value={workEmail}
            onChange={setWorkEmail}
            error={errors.workEmail}
            hint="O colaborador entra com a conta da empresa; a ligação faz-se no primeiro acesso."
            required
          />
        </div>
        <div className="actions">
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? 'A criar…' : 'Criar conta'}
          </button>
        </div>
      </form>

      <form className="search" role="search" onSubmit={search}>
        <label htmlFor="account-search">Pesquisar pelo nome ou e-mail</label>
        <input id="account-search" type="search" value={searchText} maxLength={100} onChange={(e) => setSearchText(e.target.value)} />
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

      {accounts.isPending ? (
        <Notice>A carregar as contas…</Notice>
      ) : accounts.isError ? (
        <div className="panel">
          <Notice tone="error">Não foi possível carregar as contas.</Notice>
          <div className="actions">
            <button type="button" onClick={() => void accounts.refetch()} disabled={accounts.isFetching}>
              Tentar de novo
            </button>
          </div>
        </div>
      ) : accounts.data.total === 0 ? (
        <Notice>{q ? `Nenhuma conta corresponde a «${q}».` : 'Ainda não há contas.'}</Notice>
      ) : (
        <>
          <p className="muted" aria-live="polite">
            {accounts.data.total === 1 ? '1 conta' : `${accounts.data.total} contas`}
            {q ? ` para «${q}»` : ''}
          </p>
          <ul className="card-list">
            {accounts.data.items.map((a) => (
              <li key={a.id} className="card">
                <span className="card__title">{a.name}</span>
                {a.isAdmin ? <span className="badge"> Administrador</span> : null}
                <p className="card__text">
                  {a.workEmail} · <span className="muted">{accountStatus(a)}</span>
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            page={accounts.data.page}
            pageSize={accounts.data.pageSize}
            total={accounts.data.total}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set('page', String(p));
              setParams(next);
            }}
          />
        </>
      )}
    </section>
  );
}
