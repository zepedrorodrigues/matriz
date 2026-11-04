import { useQuery } from '@tanstack/react-query';
import { getHealth } from './api/client';

/** I0 — página provisória que confirma a ligação ao backend; o início de sessão chega no I1. */
export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: false });

  let message: string;
  if (health.isPending) message = 'A verificar o serviço…';
  else if (health.isError) message = 'Não foi possível contactar o serviço. Tente novamente mais tarde.';
  else if (health.data.database === 'ok') message = 'Serviço e base de dados disponíveis.';
  else message = 'O serviço está em execução, mas a base de dados não está disponível.';

  return (
    <main>
      <h1>Matriz</h1>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
