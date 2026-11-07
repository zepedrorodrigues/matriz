import { Button } from '@/components/ui/button';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getUserMemberships, listTeams, replaceUserMemberships, type TeamRole } from '../../api/client';
import { Notice } from '../../components/Notice';
import { allocationTotal, parseAllocation, validateAllocations } from '../../domain/memberships';

interface Row {
  teamId: string;
  role: TeamRole;
  allocationPct: string;
}

interface MembershipEditorProps {
  userId: string;
  userName: string;
  /** Ao acrescentar um membro a partir de uma equipa: essa equipa já aparece na lista. */
  addTeamId?: string;
  onDone: (message: string) => void;
  onCancel: () => void;
  /** Ao guardar, o ecrã apaga a mensagem de uma operação anterior (Ex. 8, caso 09). */
  onOperationStart?: () => void;
}

/**
 * Editor das pertenças de um utilizador (CA01.9; RN06, RN21, RN34; F18): o conjunto completo das
 * equipas ativas, com papel e alocação, guardado numa só operação — a soma tem de ser 100 (ou nenhuma
 * equipa). As equipas desativadas aparecem à parte e não se alteram. A API decide sempre (p. ex. 409 se
 * uma equipa ficasse sem líder) e a interface mostra o motivo, mantendo os valores escritos.
 */
export function MembershipEditor({ userId, userName, addTeamId, onDone, onCancel, onOperationStart }: MembershipEditorProps) {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ['memberships', userId], queryFn: () => getUserMemberships(userId) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: listTeams });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // As pertenças atuais preenchem o editor uma vez; a partir daí, os valores são os escritos.
  useEffect(() => {
    if (!current.data || rows !== null) return;
    const active: Row[] = current.data.memberships
      .filter((m) => m.teamActive)
      .map((m) => ({ teamId: m.teamId, role: m.role, allocationPct: String(m.allocationPct) }));
    if (addTeamId && !active.some((r) => r.teamId === addTeamId)) active.push({ teamId: addTeamId, role: 'member', allocationPct: '' });
    setRows(active);
  }, [current.data, rows, addTeamId]);

  const save = useMutation({
    mutationFn: (input: Row[]) =>
      replaceUserMemberships(
        userId,
        input.map((r) => ({ teamId: r.teamId, role: r.role, allocationPct: parseAllocation(r.allocationPct)! })),
      ),
    onMutate: () => onOperationStart?.(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['memberships', userId] }),
        queryClient.invalidateQueries({ queryKey: ['team'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      onDone(`Pertenças de ${userName} guardadas.`);
    },
  });

  if (current.isPending || teams.isPending || rows === null) return <Notice>A carregar as pertenças…</Notice>;
  if (current.isError || teams.isError) return <Notice tone="error">Não foi possível carregar as pertenças.</Notice>;

  const activeTeams = teams.data.filter((t) => t.active);
  const inactive = current.data.memberships.filter((m) => !m.teamActive);
  const check = validateAllocations(rows);
  const total = allocationTotal(rows);
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    setSubmitted(true);
    if (Object.keys(check.rows).length === 0 && !check.total) save.mutate(rows);
  };

  return (
    <form className="flex flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={submit} noValidate aria-label={`Pertenças de ${userName}`}>
      <h3 className="m-0 text-sm font-semibold">Pertenças de {userName}</h3>
      {save.error ? <Notice tone="error">{save.error instanceof ApiError ? save.error.message : 'Não foi possível guardar.'}</Notice> : null}
      {rows.length === 0 ? <p className="m-0 text-sm text-muted-foreground">Sem equipas ativas. Guardar assim retira o utilizador de todas as equipas.</p> : null}

      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`m-team-${i}`}>Equipa</label>
            <select id={`m-team-${i}`} value={r.teamId} onChange={(e) => update(i, { teamId: e.target.value })}>
              <option value="">Escolha a equipa</option>
              {activeTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`m-role-${i}`}>Papel</label>
            <select id={`m-role-${i}`} value={r.role} onChange={(e) => update(i, { role: e.target.value as TeamRole })}>
              <option value="member">Membro</option>
              <option value="leader">Líder</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`m-pct-${i}`}>Alocação (%)</label>
            <input
              id={`m-pct-${i}`}
              type="text"
              inputMode="numeric"
              value={r.allocationPct}
              aria-invalid={submitted && check.rows[i] ? true : undefined}
              aria-describedby={submitted && check.rows[i] ? `m-err-${i}` : undefined}
              onChange={(e) => update(i, { allocationPct: e.target.value })}
            />
            {submitted && check.rows[i] ? (
              <span id={`m-err-${i}`} className="m-0 text-xs font-medium text-destructive">
                {check.rows[i]}
              </span>
            ) : null}
          </div>
          <Button variant="link" className="h-auto self-start p-0" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            Retirar da equipa
          </Button>
        </div>
      ))}

      <p className={total === 100 || rows.length === 0 ? 'm-0 text-sm text-muted-foreground' : 'm-0 text-sm font-medium text-destructive'} aria-live="polite">
        Total: {total} %{rows.length > 0 && total !== 100 ? ' — tem de ser 100 %' : ''}
      </p>
      {submitted && check.total ? <Notice tone="error">{check.total}</Notice> : null}

      {inactive.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Equipas desativadas (mantidas no histórico, não contam para a soma): {inactive.map((m) => `${m.teamName} (${m.allocationPct} %)`).join(', ')}.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" type="button" onClick={() => setRows([...rows, { teamId: '', role: 'member', allocationPct: '' }])}>
          Acrescentar equipa
        </Button>
        <Button variant="outline" type="button" onClick={onCancel} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'A guardar…' : 'Guardar pertenças'}
        </Button>
      </div>
    </form>
  );
}
