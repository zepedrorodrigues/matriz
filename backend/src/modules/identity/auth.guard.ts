import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors } from 'jose';
import { ACCESS_REQUIREMENT, type AccessRequirement } from '../../shared/auth/access.decorators';
import { AuthenticatedUser, IS_PUBLIC } from '../../shared/auth/auth.decorators';
import { AccessService } from './access.service';
import { AccountService } from './account.service';
import { TokenVerifier } from './token-verifier.service';

interface AuthRequest {
  headers: { authorization?: string };
  params: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  user?: AuthenticatedUser;
}

/** O corpo JSON já interpretado (o guarda corre antes da validação); outro conteúdo conta como vazio. */
const asRecord = (body: unknown): Record<string, unknown> =>
  body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

/**
 * Guarda global (SEC01, CAT01): todas as rotas exigem um token de acesso válido, exceto as marcadas
 * com @Public(). Sem token ou com token inválido → 401; token válido sem conta ativa na Matriz → 403.
 * A identidade vem sempre do token, nunca do pedido (Ficha PL 03, Ex. 3.3).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly accounts: AccountService,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Falta o token de acesso.');

    let identity;
    try {
      identity = await this.verifier.verify(match[1]);
    } catch (error) {
      if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
        throw new UnauthorizedException('O token de acesso é inválido ou expirou.');
      }
      throw new ServiceUnavailableException('Não foi possível validar o token junto do fornecedor de identidade.');
    }

    const user = await this.accounts.resolve(identity);
    if (!user) throw new ForbiddenException('Não existe uma conta ativa na Matriz para este utilizador.');
    req.user = { id: user.id, isAdmin: user.isAdmin };

    // Permissão declarada na rota (matriz §3.1); recusada antes do controlador, sem alterar dados (SEC02).
    const requirement = this.reflector.getAllAndOverride<AccessRequirement>(ACCESS_REQUIREMENT, [ctx.getHandler(), ctx.getClass()]);
    if (requirement) {
      await this.access.enforce(req.user, requirement, req.params, asRecord(req.body), asRecord(req.query));
    }
    return true;
  }
}
