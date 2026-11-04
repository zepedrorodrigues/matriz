import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** Entidades do módulo Organização (database.md §2.2). Só este módulo lê ou escreve estas tabelas. */

export type TeamRole = 'leader' | 'member';

@Entity({ schema: 'organization', name: 'team' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ schema: 'organization', name: 'team_membership' })
export class TeamMembership {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId!: string;

  /** Referência lógica a identity.user. */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: ['leader', 'member'], enumName: 'team_role' })
  role!: TeamRole;

  @Column({ name: 'allocation_pct', type: 'smallint' })
  allocationPct!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ schema: 'organization', name: 'project' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  objective!: string | null;

  /** Eliminação lógica (RN38). */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ schema: 'organization', name: 'project_manager' })
export class ProjectManager {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  /** Referência lógica a identity.user. */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;
}

@Entity({ schema: 'organization', name: 'project_team' })
export class ProjectTeam {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId!: string;
}
