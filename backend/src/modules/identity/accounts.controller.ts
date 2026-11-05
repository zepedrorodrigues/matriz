import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdminOnly } from '../../shared/auth/access.decorators';
import { CreateUserDto, ListUsersQuery } from './accounts.dto';
import { AccountsService } from './accounts.service';
import type { UserAccount, UserAccountPage } from './accounts.service';

/** openapi.yaml: listUsers, createUser — só o administrador (§3.1), verificado pelo guarda global. */
@Controller('users')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @AdminOnly()
  list(@Query() query: ListUsersQuery): Promise<UserAccountPage> {
    return this.accounts.list(query.q, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateUserDto): Promise<UserAccount> {
    return this.accounts.create(dto.name, dto.workEmail);
  }
}
