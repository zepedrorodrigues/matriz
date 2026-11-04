import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { requireEnv } from '../../shared/config/load-env';
import { OrganizationModule } from '../organization/organization.module';
import { AccessService } from './access.service';
import { AccountService } from './account.service';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { discoveredKeySet, OIDC_KEY_SET, TokenVerifier } from './token-verifier.service';
import { User } from './user.entity';

/**
 * Módulo Identidade e acesso (architecture.md §5): autenticação OIDC, contas de utilizador e
 * avaliação da matriz de permissões. Depende do módulo Organização, nunca o contrário (§6).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), OrganizationModule],
  controllers: [MeController],
  providers: [
    { provide: OIDC_KEY_SET, useFactory: () => discoveredKeySet(requireEnv('OIDC_ISSUER')) },
    TokenVerifier,
    AccountService,
    AccessService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AccessService],
})
export class IdentityModule {}
