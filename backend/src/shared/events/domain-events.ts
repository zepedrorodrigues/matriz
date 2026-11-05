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

/**
 * Autor das ações do sistema, sem pessoa associada (p. ex. o fim automático de uma sprint, RN36):
 * identificador reservado que não corresponde a nenhuma conta (decisão do humano, F19; database.md §2.6).
 */
export const SYSTEM_AUTHOR_ID = '00000000-0000-0000-0000-000000000000';

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
