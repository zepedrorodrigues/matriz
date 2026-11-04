import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** identity.user (database.md §2.1) — colaborador interno com acesso à aplicação (SEC01, SEC05). */
@Entity({ schema: 'identity', name: 'user' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identificador no fornecedor OIDC (claim `sub`); preenchido no primeiro acesso (RN35). */
  @Column({ name: 'external_subject', type: 'text', nullable: true })
  externalSubject!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'work_email', type: 'text' })
  workEmail!: string;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
