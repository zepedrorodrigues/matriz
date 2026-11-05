import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/** openapi.yaml: UserAccount */
export interface UserAccount {
  id: string;
  name: string;
  workEmail: string;
  isAdmin: boolean;
  active: boolean;
  linked: boolean;
  createdAt: string;
}

export interface UserAccountPage {
  page: number;
  pageSize: number;
  total: number;
  items: UserAccount[];
}

/** Violação do índice único sobre lower(work_email). */
const UNIQUE_VIOLATION = '23505';
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const toAccount = (u: User): UserAccount => ({
  id: u.id,
  name: u.name,
  workEmail: u.workEmail,
  isAdmin: u.isAdmin,
  active: u.active,
  linked: u.externalSubject !== null,
  createdAt: u.createdAt.toISOString(),
});

/**
 * Contas de utilizador (US01, CA01.13, RN35), geridas pelo administrador — a autorização é verificada
 * antes pelo guarda global (§3.1). A conta é criada ativa e por ligar; a ligação à identidade faz-se no
 * primeiro acesso (AccountService). Nunca guarda nem pede palavras-passe: a autenticação é do
 * fornecedor de identidade (DT04, SEC08).
 */
@Injectable()
export class AccountsService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Pesquisa pelo nome ou pelo e-mail, sem distinguir maiúsculas; ordenadas pelo nome, com o total. */
  async list(q: string | undefined, page: number, pageSize: number): Promise<UserAccountPage> {
    const query = this.users.createQueryBuilder('u');
    const search = q?.trim();
    if (search) query.where('(u.name ILIKE :p OR u.work_email ILIKE :p)', { p: likePattern(search) });
    const [rows, total] = await query
      .orderBy('lower(u.name)')
      .addOrderBy('u.id')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { page, pageSize, total, items: rows.map(toAccount) };
  }

  /** CA01.13: um e-mail já usado por outra conta, sem distinguir maiúsculas, responde 409. */
  async create(name: string, workEmail: string): Promise<UserAccount> {
    try {
      const saved = await this.users.save(this.users.create({ name, workEmail, isAdmin: false, active: true, externalSubject: null }));
      return toAccount(saved);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('Já existe uma conta com este e-mail profissional.');
      }
      throw error;
    }
  }
}
