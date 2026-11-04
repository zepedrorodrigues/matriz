import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ORGANIZATION_ENTITIES, OrganizationReader } from './organization-reader.service';

/** Módulo Organização (architecture.md §5): equipas, pertenças, projetos e gestores. */
@Module({
  imports: [TypeOrmModule.forFeature(ORGANIZATION_ENTITIES)],
  providers: [OrganizationReader],
  exports: [OrganizationReader],
})
export class OrganizationModule {}
