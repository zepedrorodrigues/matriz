import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { requireEnv } from '../../shared/config/load-env';

/** Chaves públicas do fornecedor OIDC; substituível nos testes por um conjunto local. */
export const OIDC_KEY_SET = Symbol('OIDC_KEY_SET');

export interface VerifiedIdentity {
  /** Claim `sub`: identificador estável do utilizador no fornecedor. */
  subject: string;
  email?: string;
  emailVerified: boolean;
}

/**
 * Conjunto de chaves descoberto a partir do emissor (`/.well-known/openid-configuration` → `jwks_uri`),
 * obtido no primeiro pedido e guardado em cache pelo jose. Se a descoberta falhar, tenta de novo no
 * pedido seguinte.
 */
export function discoveredKeySet(issuer: string): JWTVerifyGetKey {
  let remote: Promise<JWTVerifyGetKey> | undefined;
  return async (header, token) => {
    remote ??= fetch(`${issuer}/.well-known/openid-configuration`)
      .then((res) => {
        if (!res.ok) throw new Error(`Descoberta OIDC falhou com o código ${res.status}.`);
        return res.json() as Promise<{ jwks_uri: string }>;
      })
      .then((config) => createRemoteJWKSet(new URL(config.jwks_uri)));
    try {
      return await (await remote)(header, token);
    } catch (error) {
      remote = undefined;
      throw error;
    }
  };
}

/**
 * Valida o token de acesso (DT04, architecture.md §7): assinatura com as chaves do fornecedor,
 * emissor (`OIDC_ISSUER`), audiência (`OIDC_AUDIENCE`) e validade. Sem sessão no servidor.
 */
@Injectable()
export class TokenVerifier {
  constructor(@Inject(OIDC_KEY_SET) private readonly keySet: JWTVerifyGetKey) {}

  async verify(token: string): Promise<VerifiedIdentity> {
    const { payload } = await jwtVerify(token, this.keySet, {
      issuer: requireEnv('OIDC_ISSUER'),
      audience: requireEnv('OIDC_AUDIENCE'),
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp'],
    });
    return {
      subject: payload.sub!,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: payload.email_verified === true,
    };
  }
}
