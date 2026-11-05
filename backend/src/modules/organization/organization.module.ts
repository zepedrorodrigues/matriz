import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ORGANIZATION_ENTITIES, OrganizationReader } from './organization-reader.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

/** Módulo Organização (architecture.md §5): equipas, pertenças, projetos e gestores. */
@Module({
  imports: [TypeOrmModule.forFeature(ORGANIZATION_ENTITIES)],
  controllers: [ProjectsController, TeamsController],
  providers: [OrganizationReader, ProjectsService, TeamsService],
  exports: [OrganizationReader],
})
export class OrganizationModule {}
