/**
 * Configuração pública do OIDC (DT04). Na imagem de produção vem de `/config.js`, escrito no arranque
 * do contentor, para que a mesma imagem sirva qualquer ambiente; em desenvolvimento valem as
 * variáveis VITE_OIDC_* do .env da raiz.
 */
interface MatrizConfig {
  oidcAuthority?: string;
  oidcClientId?: string;
}

declare global {
  interface Window {
    __MATRIZ_CONFIG__?: MatrizConfig;
  }
}

const runtime: MatrizConfig = window.__MATRIZ_CONFIG__ ?? {};

export const oidcAuthority: string = runtime.oidcAuthority || import.meta.env.VITE_OIDC_AUTHORITY;
export const oidcClientId: string = runtime.oidcClientId || import.meta.env.VITE_OIDC_CLIENT_ID;
