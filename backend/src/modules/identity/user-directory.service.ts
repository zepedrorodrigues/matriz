import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import type { UserDirectory } from '../../shared/ports/user-directory';
import { User } from './user.entity';

/** Implementação de UserDirectory pelo módulo dono dos utilizadores (architecture.md §6). */
@Injectable()
export class UserDirectoryService implements UserDirectory {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async namesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.users.find({ where: { id: In(ids) }, select: { id: true, name: true } });
    return new Map(rows.map((u) => [u.id, u.name]));
  }

  async activeUsers(ids?: string[]): Promise<{ id: string; name: string }[]> {
    if (ids && ids.length === 0) return [];
    const where: FindOptionsWhere<User> = ids ? { id: In(ids), active: true } : { active: true };
    return this.users.find({ where, select: { id: true, name: true }, order: { name: 'ASC', id: 'ASC' } });
  }
}
