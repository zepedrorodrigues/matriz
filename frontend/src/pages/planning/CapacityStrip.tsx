import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, getSprintCapacity, resetAvailability, setAvailability, type MemberCapacity, type SprintCapacity } from '@/api/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AVAILABILITY_MESSAGE, hoursText, parseAvailability, remainingText } from '@/domain/capacity';
import { initials } from '@/domain/people';
import { cn } from '@/lib/utils';

const ROLE = { leader: 'Líder', member: 'Membro' } as const;
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível guardar.');

/** Barra planeado/capacidade: até 100 % na cor principal, o excesso a laranja (RN19). */
function LoadBar({ planned, capacity, className }: { planned: number; capacity: number; className?: string }) {
  const within = capacity <= 0 ? 0 : Math.min(planned, capacity) / Math.max(planned, capacity);
  const over = planned > capacity ? (planned - capacity) / planned : 0;
  return (
    <div aria-hidden="true" className={cn('flex h-2 overflow-hidden rounded-full bg-muted', className)}>
      <div className="bg-primary" style={{ width: `${within * 100}%` }} />
      {over > 0 ? <div className="bg-[#d9480f]" style={{ width: `${over * 100}%` }} /> : null}
    </div>
  );
}

/**
 * Capacidade da sprint (US05: CA05.1–CA05.7, CA05.9–CA05.11; RN06, RN19): totais da equipa com a sobrecarga
 * assinalada sem bloquear; story points à parte, nunca convertidos; uma barra por pessoa conforme SEC07 (a
 * API só devolve as linhas que o utilizador pode ver); «Ajustar horas» para o líder, que pede só as horas
 * (SEC06).
 */
export function CapacityStrip({ sprintId, mayAdjust }: { sprintId: string; mayAdjust: boolean }) {
  const capacity = useQuery({ queryKey: ['capacity', sprintId], queryFn: () => getSprintCapacity(sprintId) });
  const [editing, setEditing] = useState<MemberCapacity | null>(null);

  if (capacity.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (capacity.isError) return <p className="m-0 rounded-xl border bg-card p-4 text-sm text-destructive">Não foi possível carregar a capacidade.</p>;
  const c = capacity.data;

  return (
    <section aria-labelledby="capacity-title" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex min-w-64 flex-[2_1_280px] flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="capacity-title" className="m-0 text-sm font-semibold">
              Capacidade · {hoursText(c.plannedHours)} planeadas de {hoursText(c.capacityHours)}
            </h2>
            <span className={cn('text-sm font-semibold', c.overloaded ? 'text-destructive' : 'text-muted-foreground')}>{remainingText(c.remainingHours)}</span>
          </div>
          <LoadBar planned={c.plannedHours} capacity={c.capacityHours} className="h-2.5" />
          {c.overloaded ? (
            <p role="status" className="m-0 flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              Sobrecarga da equipa: o planeamento continua possível e a equipa foi notificada.
            </p>
          ) : null}
        </div>
        <dl className="m-0 flex gap-6">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Story points</dt>
            <dd className="m-0 text-xl font-bold">{c.plannedStoryPoints} SP</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Sem story points</dt>
            <dd className="m-0 text-xl font-bold">{c.tasksWithoutStoryPoints}</dd>
          </div>
        </dl>
      </div>
      {c.tasksWithoutStoryPoints > 0 ? (
        <p className="m-0 text-xs text-muted-foreground">As tarefas sem story points contam como 0. As horas e os story points nunca se convertem.</p>
      ) : null}

      {c.members.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">Os dados individuais só são visíveis ao líder da equipa e, a cada membro, os seus (SEC07).</p>
      ) : (
        <ul aria-label="Capacidade por pessoa" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6 gap-y-3 p-0">
          {c.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <LoadBar planned={m.plannedHours} capacity={m.capacityHours} />
                <span className="text-xs text-muted-foreground">
                  <span className={cn(m.overloaded && 'font-semibold text-destructive')}>
                    {hoursText(m.plannedHours)} de {hoursText(m.capacityHours)}
                    {m.availabilityAdjusted ? ' (ajustada)' : ''}
                  </span>{' '}
                  · {ROLE[m.role]} · {m.allocationPct} %
                </span>
                <span className="sr-only">{remainingText(m.remainingHours)}{m.overloaded ? ', em sobrecarga' : ''}</span>
              </div>
              {mayAdjust ? (
                <Button variant="outline" size="icon" className="size-9" aria-label={`Ajustar horas de ${m.name}`} onClick={() => setEditing(m)}>
                  <Pencil aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? <AdjustDialog sprintId={sprintId} member={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function AdjustDialog({ sprintId, member, onClose }: { sprintId: string; member: MemberCapacity; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(String(member.capacityHours).replace('.', ','));
  const [fieldError, setFieldError] = useState<string>();
  const done = (c: SprintCapacity, message: string) => {
    queryClient.setQueryData(['capacity', sprintId], c);
    toast.success(message);
    onClose();
  };
  const adjust = useMutation({
    mutationFn: (value: number) => setAvailability(sprintId, member.userId, value),
    onSuccess: (c) => done(c, `Horas de ${member.name} ajustadas.`),
  });
  const reset = useMutation({ mutationFn: () => resetAvailability(sprintId, member.userId), onSuccess: (c) => done(c, 'Horas repostas segundo o cálculo da sprint.') });
  const busy = adjust.isPending || reset.isPending;
  const error = adjust.error ?? reset.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = parseAvailability(hours);
    setFieldError(value === undefined ? AVAILABILITY_MESSAGE : undefined);
    if (value !== undefined) adjust.mutate(value);
  };

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Ajustar horas de {member.name}</DialogTitle>
            <DialogDescription>Horas disponíveis nesta sprint. Só as horas: o motivo não é pedido nem registado.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="avail-hours">Horas disponíveis</Label>
            <Input
              id="avail-hours"
              inputMode="decimal"
              value={hours}
              autoFocus
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'avail-error' : undefined}
              onChange={(e) => setHours(e.target.value)}
              className="h-10"
            />
            {fieldError ? (
              <span id="avail-error" className="text-xs font-medium text-destructive">
                {fieldError}
              </span>
            ) : null}
            {error ? <span className="text-xs font-medium text-destructive">{errorText(error)}</span> : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {member.availabilityAdjusted ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => reset.mutate()}>
                Repor o cálculo
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {adjust.isPending ? 'A guardar…' : 'Guardar horas'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
