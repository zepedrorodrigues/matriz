import type { AuthProviderProps } from 'react-oidc-context';

/**
 * Sessão OIDC (DT04, openapi.yaml › Ciclo da sessão): Authorization Code + PKCE no Keycloak, cliente
 * público `matriz-web`. O token de acesso fica só no sessionStorage do separador (predefinição do
 * oidc-client-ts) e é renovado antes de expirar com o refresh token.
 */
export const oidcConfig: AuthProviderProps = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: 'openid profile email',
  automaticSilentRenew: true,
  // Depois do regresso do Keycloak, retira `code` e `state` do endereço.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
