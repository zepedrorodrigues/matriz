import { useEffect, useState, type ReactNode } from 'react';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { useQueryClient } from '@tanstack/react-query';
import { onSessionInvalid } from '../api/client';
import { consumeSessionExpired, markSessionExpired } from './session-notice';

/**
 * Só mostra a aplicação com sessão iniciada (SEC01, CAT01). Sem sessão, encaminha para o início de
 * sessão no Keycloak; se a sessão deixou de ser válida (token expirado sem renovação, renovação
 * falhada ou 401 da API), mostra primeiro uma mensagem compreensível (Ficha PL 03, Ex. 3).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [expired] = useState(consumeSessionExpired);

  // 401 da API: a sessão deixou de ser válida.
  useEffect(() => {
    onSessionInvalid(() => {
      markSessionExpired();
      queryClient.clear();
      void auth.removeUser().then(() => window.location.reload());
    });
  }, [auth, queryClient]);

  // Renovação falhada ou token expirado: termina a sessão local e mostra a mensagem.
  useEffect(() => {
    const endSession = () => {
      markSessionExpired();
      queryClient.clear();
      void auth.removeUser().then(() => window.location.reload());
    };
    const offExpired = auth.events.addAccessTokenExpired(endSession);
    const offRenewError = auth.events.addSilentRenewError(endSession);
    return () => {
      offExpired();
      offRenewError();
    };
  }, [auth, queryClient]);

  // Primeiro acesso sem sessão: encaminha diretamente para o início de sessão.
  const mustSignIn = !auth.isAuthenticated && !auth.isLoading && !auth.activeNavigator && !auth.error && !hasAuthParams();
  useEffect(() => {
    if (mustSignIn && !expired) void auth.signinRedirect();
  }, [mustSignIn, expired, auth]);

  if (auth.isLoading || auth.activeNavigator) {
    return <StatusScreen message="A preparar a sessão…" />;
  }
  if (auth.error) {
    return (
      <StatusScreen message="Não foi possível iniciar sessão. Tente novamente." tone="error">
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Iniciar sessão
        </button>
      </StatusScreen>
    );
  }
  if (!auth.isAuthenticated) {
    return expired ? (
      <StatusScreen message="A sua sessão expirou ou deixou de ser válida. Inicie sessão novamente." tone="warning">
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Iniciar sessão
        </button>
      </StatusScreen>
    ) : (
      <StatusScreen message="A encaminhar para o início de sessão…" />
    );
  }
  return <>{children}</>;
}

export function StatusScreen({
  message,
  tone = 'info',
  children,
}: {
  message: string;
  tone?: 'info' | 'warning' | 'error';
  children?: ReactNode;
}) {
  return (
    <main className="status-screen">
      <h1>Matriz</h1>
      <p className={`notice notice--${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
        {message}
      </p>
      {children}
    </main>
  );
}
