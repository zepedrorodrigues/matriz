import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

/** Utilizador da Matriz associado ao token validado; nunca vem do corpo do pedido (architecture.md §7). */
export interface AuthenticatedUser {
  id: string;
  isAdmin: boolean;
}

export const IS_PUBLIC = 'matriz:isPublic';

/** Marca uma rota como acessível sem token (só `GET /health`). Todas as outras exigem autenticação (SEC01). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injeta o utilizador autenticado, resolvido pelo guarda de autenticação. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
});
