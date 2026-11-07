import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router';
import type { Priority, TaskState, UserSummary } from '@/api/client';
import { Flag, STATE_DOT, StateBadge } from '@/components/task-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BACKLOG, moveOptions, resolveDrop, type BoardMove, type ColumnId } from '@/domain/board';
import { hoursText } from '@/domain/capacity';
import { initials } from '@/domain/people';
import { STATE_LABEL, TASK_STATES } from '@/domain/tasks';
import { cn } from '@/lib/utils';

/** Um cartão do quadro: tarefa da sprint ou do backlog, com o que este utilizador pode fazer com ela. */
export interface BoardCard {
  id: string;
  title: string;
  projectName: string;
  isSubtask: boolean;
  state: TaskState;
  priority: Priority;
  estimateHours: number | null;
  storyPoints: number | null;
  assignee: UserSummary | null;
  column: ColumnId;
  /** Estados para onde este utilizador pode levar a tarefa (stateTargetsFor). */
  targets: TaskState[];
  blockReason?: string | null;
  isBlocked?: boolean;
  isOverdue?: boolean;
  addedAfterStart?: boolean;
  /** Só no backlog: porque não pode ser planeada (RN27, concluída, noutra sprint). */
  notPlannableReason?: string;
}

const estimateText = (c: BoardCard) =>
  c.estimateHours === null ? 'Sem estimativa' : `${hoursText(c.estimateHours)}${c.storyPoints === null ? ' · sem SP' : ` · ${c.storyPoints} SP`}`;

const contextFor = (c: BoardCard, mayPlan: boolean) => ({
  from: c.column,
  state: c.state,
  targets: c.targets,
  mayPlan,
  notPlannableReason: c.notPlannableReason,
});

/**
 * Quadro da sprint (DT17, direção «B · Quadro»): o backlog da equipa como primeira coluna (só para o líder,
 * com a sprint aberta) e uma coluna por estado (RN17). Arrastar um cartão do backlog planeia-o; de uma
 * coluna de estado para o backlog retira-o; entre colunas de estado muda o estado (RN26). Cada cartão tem o
 * menu «Mover para…» com os mesmos destinos, para quem usa o teclado ou um leitor de ecrã (RNF12).
 */
export function SprintBoard({
  cards,
  showBacklog,
  mayPlan,
  readOnly,
  busy,
  onMove,
  onRefuse,
}: {
  cards: BoardCard[];
  showBacklog: boolean;
  mayPlan: boolean;
  readOnly: boolean;
  busy: boolean;
  onMove: (card: BoardCard, move: Exclude<BoardMove, { kind: 'none' } | { kind: 'refuse' }>) => void;
  onRefuse: (reason: string) => void;
}) {
  const [active, setActive] = useState<BoardCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const columns: ColumnId[] = [...(showBacklog ? [BACKLOG] : []), ...TASK_STATES];

  const drop = (card: BoardCard, to: ColumnId) => {
    const move = resolveDrop({ ...contextFor(card, mayPlan), to });
    if (move.kind === 'none') return;
    if (move.kind === 'refuse') onRefuse(move.reason);
    else onMove(card, move);
  };
  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as { card: BoardCard }).card);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const card = (e.active.data.current as { card: BoardCard }).card;
    if (e.over) drop(card, e.over.id as ColumnId);
  };
  /** Durante o arrasto: as colunas que aceitam o cartão ficam realçadas, as outras esbatidas. */
  const accepts = (column: ColumnId) => {
    if (!active) return undefined;
    const kind = resolveDrop({ ...contextFor(active, mayPlan), to: column }).kind;
    return kind !== 'refuse' && kind !== 'none';
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        screenReaderInstructions: { draggable: 'Use o menu de ações do cartão para o mover entre colunas.' },
        announcements: {
          onDragStart: () => 'A mover o cartão.',
          onDragOver: ({ over }) => (over ? `Sobre a coluna ${columnTitle(over.id as ColumnId)}.` : 'Fora das colunas.'),
          onDragEnd: ({ over }) => (over ? `Largado na coluna ${columnTitle(over.id as ColumnId)}.` : 'Largado fora das colunas.'),
          onDragCancel: () => 'Movimento cancelado.',
        },
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="grid w-max auto-cols-[264px] grid-flow-col gap-3">
          {columns.map((column) => (
            <BoardColumn key={column} id={column} accepts={accepts(column)}>
              {cards
                .filter((c) => c.column === column)
                .map((c) => (
                  <DraggableCard key={c.id} card={c} disabled={readOnly || busy}>
                    <CardBody card={c} mayPlan={mayPlan} readOnly={readOnly || busy} onPick={(to) => drop(c, to)} />
                  </DraggableCard>
                ))}
            </BoardColumn>
          ))}
        </div>
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-[248px] rotate-1 rounded-lg border bg-card p-3 shadow-lg">
            <span className="font-medium">{active.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const columnTitle = (column: ColumnId) => (column === BACKLOG ? 'Backlog da equipa' : STATE_LABEL[column]);

function BoardColumn({ id, accepts, children }: { id: ColumnId; accepts: boolean | undefined; children: React.ReactNode[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const titleId = `col-${id}`;
  const backlog = id === BACKLOG;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      className={cn(
        'flex min-h-96 flex-col gap-2 rounded-xl p-2.5 transition-[opacity,box-shadow]',
        backlog ? 'border border-dashed border-input bg-card' : 'bg-muted',
        accepts === true && 'ring-2 ring-primary/40',
        accepts === true && isOver && 'ring-primary',
        accepts === false && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2 px-1 pb-1">
        {backlog ? null : <span aria-hidden="true" className={cn('size-2 rounded-full', STATE_DOT[id])} />}
        <h2 id={titleId} className="m-0 text-[13px] font-semibold">
          {columnTitle(id)}
        </h2>
        <span className="rounded-full bg-card px-2 text-xs text-muted-foreground" aria-label={`${children.length} tarefas`}>
          {children.length}
        </span>
      </div>
      {children.length === 0 ? (
        <p className="m-0 px-1 py-3 text-xs text-muted-foreground">{backlog ? 'Sem tarefas no backlog.' : 'Sem tarefas.'}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>
      )}
    </section>
  );
}

function DraggableCard({ card, disabled, children }: { card: BoardCard; disabled: boolean; children: React.ReactNode }) {
  // Só o rato arrasta (listeners no cartão, sem attributes): quem usa o teclado tem o menu «Mover para…».
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: card.id, data: { card }, disabled });
  return (
    <li ref={setNodeRef} {...listeners} className={cn('touch-none', !disabled && 'cursor-grab', isDragging && 'opacity-40')}>
      {children}
    </li>
  );
}

function CardBody({ card, mayPlan, readOnly, onPick }: { card: BoardCard; mayPlan: boolean; readOnly: boolean; onPick: (to: ColumnId) => void }) {
  const options = readOnly ? [] : moveOptions(contextFor(card, mayPlan));
  return (
    <article className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs hover:border-primary/40">
      <div className="flex items-start gap-1">
        <Link to={`/tarefas/${card.id}`} className="flex-1 text-sm leading-snug font-medium text-foreground hover:underline">
          {card.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-8 shrink-0 text-muted-foreground" aria-label={`Ações de «${card.title}»`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Mover para…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {options.length === 0 ? (
              <DropdownMenuItem disabled>{card.notPlannableReason ?? 'Sem movimentos disponíveis'}</DropdownMenuItem>
            ) : (
              options.map((o) => (
                <DropdownMenuItem key={o.to} onSelect={() => onPick(o.to)}>
                  {o.label}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={`/tarefas/${card.id}`}>Abrir a tarefa</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className="text-xs text-muted-foreground">
        {card.projectName}
        {card.isSubtask ? ' · Subtarefa' : ''}
      </span>
      {card.column === BACKLOG || card.isBlocked || card.isOverdue || card.addedAfterStart || card.priority === 'high' || card.notPlannableReason ? (
        <div className="flex flex-wrap gap-1.5">
          {card.column === BACKLOG ? <StateBadge state={card.state} className="text-[11px]" /> : null}
          {card.isBlocked ? <Flag tone="danger">Bloqueada</Flag> : null}
          {card.isOverdue ? <Flag tone="warning">Prazo ultrapassado</Flag> : null}
          {card.priority === 'high' ? <Flag tone="warning">Prioridade alta</Flag> : null}
          {card.addedAfterStart ? <Flag tone="info">Acrescentada depois do início</Flag> : null}
          {card.notPlannableReason ? <Flag tone="neutral">{card.estimateHours === null ? 'Sem estimativa' : 'Não planeável'}</Flag> : null}
        </div>
      ) : null}
      {card.isBlocked && card.blockReason ? <span className="text-xs text-destructive">{card.blockReason}</span> : null}
      <div className="flex items-center gap-2 text-xs text-foreground/80">
        <span>{estimateText(card)}</span>
        <span className="ml-auto">
          {card.assignee ? (
            <Avatar className="size-6" title={card.assignee.name}>
              <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">{initials(card.assignee.name)}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="text-muted-foreground">Sem responsável</span>
          )}
          {card.assignee ? <span className="sr-only">Responsável: {card.assignee.name}</span> : null}
        </span>
      </div>
    </article>
  );
}
