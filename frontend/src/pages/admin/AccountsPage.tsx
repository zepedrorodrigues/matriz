import { Button } from '@/components/ui/button';
import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ApiError, createUser, listUsers } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { Pager } from '@/components/pager';
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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <AdminNav />
      <h1 className="m-0 text-[22px] font-bold">Contas de utilizador</h1>
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={submit} noValidate>
        <h2 className="m-0 text-base font-semibold">Nova conta</h2>
        {generalError ? <Notice tone="error">{generalError}</Notice> : null}
        <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'A criar…' : 'Criar conta'}
          </Button>
        </div>
      </form>

      <form className="flex flex-wrap items-end gap-2 [&>*:first-child]:min-w-64 [&>*:first-child]:flex-1" role="search" onSubmit={search}>
        <label htmlFor="account-search">Pesquisar pelo nome ou e-mail</label>
        <input id="account-search" type="search" value={searchText} maxLength={100} onChange={(e) => setSearchText(e.target.value)} />
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

      {accounts.isPending ? (
        <Notice>A carregar as contas…</Notice>
      ) : accounts.isError ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Notice tone="error">Não foi possível carregar as contas.</Notice>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void accounts.refetch()} disabled={accounts.isFetching}>
              Tentar de novo
            </Button>
          </div>
        </div>
      ) : accounts.data.total === 0 ? (
        <Notice>{q ? `Nenhuma conta corresponde a «${q}».` : 'Ainda não há contas.'}</Notice>
      ) : (
        <>
          <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
            {accounts.data.total === 1 ? '1 conta' : `${accounts.data.total} contas`}
            {q ? ` para «${q}»` : ''}
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {accounts.data.items.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
                <span className="font-semibold text-foreground hover:underline">{a.name}</span>
                {a.isAdmin ? <span className="inline-flex w-fit items-center rounded bg-muted px-1.5 text-xs font-semibold text-muted-foreground"> Administrador</span> : null}
                <p className="m-0 text-sm text-foreground/80">
                  {a.workEmail} · <span className="m-0 text-sm text-muted-foreground">{accountStatus(a)}</span>
                </p>
              </li>
            ))}
          </ul>
          <Pager
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
