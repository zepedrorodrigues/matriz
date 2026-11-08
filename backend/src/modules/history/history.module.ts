import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../../shared/events/domain-events';
import { OrganizationModule } from '../organization/organization.module';
import { HistoryController } from './history.controller';
import { HistoryReader } from './history.reader';

/**
 * Regista cada alteração relevante em history.history_event (RN32, SEC03), na transação de quem a
 * publicou. Só acrescenta: não há operações de edição nem remoção (SEC04). A consulta do histórico
 * e as permissões só de inserção e leitura chegam no I13.
 */
@Injectable()
export class HistoryRecorder implements OnModuleInit {
  constructor(private readonly events: DomainEvents) {}

  onModuleInit(): void {
    this.events.subscribe(async (event, manager) => {
      await manager.query(
        `INSERT INTO history.history_event (entity_type, entity_id, event_type, old_value, new_value, author_id)
         VALUES ($1::history.entity_type, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [
          event.entityType,
          event.entityId,
          event.eventType,
          event.oldValue === null ? null : JSON.stringify(event.oldValue),
          event.newValue === null ? null : JSON.stringify(event.newValue),
          event.authorId,
        ],
      );
    });
  }
}

/**
 * Módulo Histórico (architecture.md §5): subscreve os eventos de domínio dos outros módulos e lê o
 * histórico (HistoryReader, I13), com os nomes pelas interfaces de leitura dos módulos donos.
 */
@Module({ imports: [OrganizationModule], controllers: [HistoryController], providers: [HistoryRecorder, HistoryReader] })
export class HistoryModule {}
