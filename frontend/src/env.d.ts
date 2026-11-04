/// <reference types="vite/client" />

/** Variáveis públicas lidas do .env da raiz (vite.config.ts: envDir). Nunca contêm segredos. */
interface ImportMetaEnv {
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
