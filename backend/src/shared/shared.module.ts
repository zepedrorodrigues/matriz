import { Global, Module } from '@nestjs/common';
import { DomainEvents } from './events/domain-events';

/** Serviços transversais disponíveis a todos os módulos. */
@Global()
@Module({
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class SharedModule {}
