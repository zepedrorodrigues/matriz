import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * Alteração relevante de um elemento (RN32, SEC03), publicada pelo módulo dono e registada pelo
 * módulo Histórico. `oldValue`/`newValue` contêm só os campos alterados.
 */
export interface ChangeEvent {
  entityType: 'team' | 'project' | 'objective' | 'epic' | 'task' | 'acceptance_criterion' | 'sprint' | 'team_membership';
  entityId: string;
  eventType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  authorId: string;
}

type Handler = (event: ChangeEvent, manager: EntityManager) => Promise<void>;

/**
 * Eventos de domínio internos (architecture.md §6): entregues dentro do processo e na mesma
 * transação do pedido, para que uma alteração nunca fique gravada sem o seu histórico (DT07, SEC03).
 * Quem publica não depende de quem subscreve.
 */
@Injectable()
export class DomainEvents {
  private readonly handlers: Handler[] = [];

  subscribe(handler: Handler): void {
    this.handlers.push(handler);
  }

  /** Executa os subscritores com o EntityManager da transação em curso; uma falha anula a transação. */
  async publish(event: ChangeEvent, manager: EntityManager): Promise<void> {
    for (const handler of this.handlers) await handler(event, manager);
  }
}
