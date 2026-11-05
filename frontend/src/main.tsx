import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from 'react-oidc-context';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ApiError } from './api/client';
import { HomePage, Layout, NotFoundPage } from './App';
import { AuthGate } from './auth/AuthGate';
import { oidcConfig } from './auth/oidc-config';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import './styles.css';

const queryClient: QueryClient = new QueryClient({
  // Ex. 7: qualquer alteração confirmada pela API (criar, editar, eliminar, mudar o estado) pode mudar
  // as contagens do painel inicial, que são marcadas como desatualizadas e pedidas de novo.
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  }),
  // Um erro 4xx (401, 403, 404…) não melhora ao repetir; os restantes tentam uma vez mais.
  defaultOptions: {
    queries: { retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 1 },
  },
});

const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projetos', element: <ProjectsPage /> },
      { path: 'projetos/:projectId', element: <ProjectDetailPage /> },
      { path: 'tarefas/:taskId', element: <TaskDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

/**
 * O router lê o endereço quando é criado; por isso só é criado depois do início de sessão, quando o
 * AuthGate já retirou do endereço os parâmetros `code` e `state` devolvidos pelo Keycloak.
 */
function AppRouter() {
  const [router] = useState(() => createBrowserRouter(routes));
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <AppRouter />
        </AuthGate>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
