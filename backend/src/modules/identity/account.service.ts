import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { VerifiedIdentity } from './token-verifier.service';

/**
 * Associa a identidade do token a uma conta da Matriz (RN35, CA01.13):
 * - acessos seguintes: pela claim `sub` guardada em `external_subject`;
 * - primeiro acesso: pelo e-mail profissional, só se o fornecedor o der como verificado e a conta
 *   ainda não estiver ligada a outra identidade; a ligação fica guardada.
 * Sem conta ativa correspondente devolve null (o pedido é recusado com 403).
 */
@Injectable()
export class AccountService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async resolve(identity: VerifiedIdentity): Promise<User | null> {
    const linked = await this.users.findOneBy({ externalSubject: identity.subject });
    if (linked) return linked.active ? linked : null;
    if (!identity.email || !identity.emailVerified) return null;

    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({ externalSubject: identity.subject })
      .where('lower(work_email) = lower(:email) AND external_subject IS NULL AND active', { email: identity.email })
      .returning('id')
      .execute();
    const [row] = result.raw as { id: string }[];
    if (row) return this.users.findOneBy({ id: row.id });

    // Outro pedido concorrente do mesmo utilizador pode ter feito a ligação entretanto.
    const raced = await this.users.findOneBy({ externalSubject: identity.subject });
    return raced?.active ? raced : null;
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
