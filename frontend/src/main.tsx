import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from 'react-oidc-context';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from './api/client';
import { AdminOnlyPage, HomePage, Layout, NotFoundPage } from './App';
import { AuthGate } from './auth/AuthGate';
import { AccountsPage } from './pages/admin/AccountsPage';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { TeamDetailPage } from './pages/admin/TeamDetailPage';
import { TeamsPage } from './pages/admin/TeamsPage';
import { oidcConfig } from './auth/oidc-config';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import { SprintPage } from './pages/planning/SprintPage';
import { TeamPlanningPage } from './pages/planning/TeamPlanningPage';
import './index.css';

const queryClient: QueryClient = new QueryClient({
  // Ex. 7: qualquer alteração confirmada pela API (criar, editar, eliminar, mudar o estado) pode mudar
  // as contagens do painel inicial e os alertas (I11), que são marcados como desatualizados e pedidos de novo.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
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
      { path: 'planeamento', element: <TeamPlanningPage /> },
      { path: 'sprints/:sprintId', element: <SprintPage /> },
      { path: 'alertas', element: <AlertsPage /> },
      { path: 'administracao/contas', element: <AdminOnlyPage><AccountsPage /></AdminOnlyPage> },
      { path: 'administracao/equipas', element: <AdminOnlyPage><TeamsPage /></AdminOnlyPage> },
      { path: 'administracao/equipas/:teamId', element: <AdminOnlyPage><TeamDetailPage /></AdminOnlyPage> },
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
        <TooltipProvider delayDuration={300}>
          <AuthGate>
            <AppRouter />
          </AuthGate>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
