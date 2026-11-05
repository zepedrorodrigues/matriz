import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ApiError, createTeam, getUserMemberships, listTeams, listUsers } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { SelectField } from '../../components/SelectField';
import { parseAllocation } from '../../domain/memberships';
import { AdminNav } from './AdminNav';

const NAME_MESSAGE = 'O nome da equipa é obrigatório, não pode ter só espaços e tem até 100 caracteres.';

/**
 * Ecrã Administração › Equipas (US01; CA01.1, CA01.8; RN06, RN33, RN34; F18): lista das equipas (as
 * desativadas assinaladas) e criação com o líder. Se o líder já pertence a outras equipas ativas, indicam-
 * se as suas alocações em todas, a somar 100 %.
 */
export function TeamsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const teams = useQuery({ queryKey: ['teams'], queryFn: listTeams });
  // As contas para escolher o líder: as ativas (até 100, o máximo de uma página; suficiente no MVP).
  const accounts = useQuery({ queryKey: ['users', { all: true }], queryFn: () => listUsers({ pageSize: 100 }) });
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [leaderPct, setLeaderPct] = useState('100');
  const [others, setOthers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const leaderTeams = useQuery({
    queryKey: ['memberships', leaderId],
    queryFn: () => getUserMemberships(leaderId),
    enabled: leaderId !== '',
  });
  const leaderActive = (leaderTeams.data?.memberships ?? []).filter((m) => m.teamActive);

  const create = useMutation({
    mutationFn: createTeam,
    onSuccess: async (team) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['memberships', leaderId] }),
      ]);
      navigate(`/administracao/equipas/${team.id}`, { state: { notice: `Equipa «${team.name}» criada.` } });
    },
  });

  const chooseLeader = (id: string) => {
    setLeaderId(id);
    setOthers({});
    setLeaderPct(id ? '' : '100');
    setErrors({});
  };

  const otherValue = (teamId: string, current: number) => others[teamId] ?? String(current);
  const total =
    (parseAllocation(leaderPct) ?? 0) + leaderActive.reduce((sum, m) => sum + (parseAllocation(otherValue(m.teamId, m.allocationPct)) ?? 0), 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    const found: Record<string, string> = {};
    if (name.trim().length < 1 || name.trim().length > 100) found.name = NAME_MESSAGE;
    if (!leaderId) found.leaderId = 'Escolha o líder (uma equipa ativa tem sempre um líder).';
    if (parseAllocation(leaderPct) === undefined) found.leaderPct = 'Indique um número inteiro de 1 a 100.';
    for (const m of leaderActive) {
      if (parseAllocation(otherValue(m.teamId, m.allocationPct)) === undefined) found[`o-${m.teamId}`] = 'Indique um número inteiro de 1 a 100.';
    }
    if (!found.leaderPct && total !== 100) found.total = `As alocações do líder têm de somar 100 % (somam ${total} %).`;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate({
      name: name.trim(),
      leaderId,
      leaderAllocationPct: parseAllocation(leaderPct)!,
      leaderOtherAllocations: leaderActive.map((m) => ({ teamId: m.teamId, allocationPct: parseAllocation(otherValue(m.teamId, m.allocationPct))! })),
    });
  };

  const fieldErrors = create.error instanceof ApiError && create.error.status === 400 ? create.error.fieldErrors() : {};

  return (
    <section className="page">
      <AdminNav />
      <h1>Equipas</h1>

      <form className="panel form" onSubmit={submit} noValidate>
        <h2>Nova equipa</h2>
        {create.error && Object.keys(fieldErrors).length === 0 ? (
          <Notice tone="error">{create.error instanceof ApiError ? create.error.message : 'Não foi possível criar a equipa.'}</Notice>
        ) : null}
        <div className="form__row">
          <FormField label="Nome" value={name} onChange={setName} error={errors.name ?? fieldErrors.name} maxLength={100} required />
          <SelectField label="Líder" value={leaderId} onChange={chooseLeader} error={errors.leaderId} required>
            <option value="">Escolha o líder</option>
            {(accounts.data?.items ?? [])
              .filter((a) => a.active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </SelectField>
        </div>

        {leaderId && leaderTeams.isPending ? <Notice>A carregar as equipas do líder…</Notice> : null}
        {leaderId && leaderTeams.data ? (
          <fieldset className="allocation-set">
            <legend>Alocações do líder (somam 100 %)</legend>
            <div className="form__row">
              <FormField label="Na nova equipa (%)" value={leaderPct} onChange={setLeaderPct} error={errors.leaderPct} />
              {leaderActive.map((m) => (
                <FormField
                  key={m.teamId}
                  label={`Em ${m.teamName} (%)`}
                  value={otherValue(m.teamId, m.allocationPct)}
                  onChange={(v) => setOthers({ ...others, [m.teamId]: v })}
                  error={errors[`o-${m.teamId}`]}
                  hint={m.role === 'leader' ? 'Líder' : 'Membro'}
                />
              ))}
            </div>
            <p className={total === 100 ? 'muted' : 'field__error'} aria-live="polite">
              Total: {total} %
            </p>
            {errors.total ? <Notice tone="error">{errors.total}</Notice> : null}
          </fieldset>
        ) : null}

        <div className="actions">
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? 'A criar…' : 'Criar equipa'}
          </button>
        </div>
      </form>

      {teams.isPending ? (
        <Notice>A carregar as equipas…</Notice>
      ) : teams.isError ? (
        <Notice tone="error">Não foi possível carregar as equipas.</Notice>
      ) : teams.data.length === 0 ? (
        <Notice>Ainda não há equipas.</Notice>
      ) : (
        <ul className="card-list">
          {teams.data.map((t) => (
            <li key={t.id} className="card">
              <Link to={`/administracao/equipas/${t.id}`} className="card__title">
                {t.name}
              </Link>
              {t.active ? null : <span className="badge"> Desativada</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
