import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Endereço do backend em desenvolvimento; o servidor do Vite encaminha /api para lá, mantendo a
// mesma origem que o proxy de produção (architecture.md §8). A aplicação usa sempre caminhos /api.
const apiTarget = 'http://localhost:3000'; // PORT do backend no .env.example

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` aponta para src/ (componentes do shadcn/ui, DT17); o mesmo alias está no tsconfig.json.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // As dependências mudam menos do que a aplicação: ficam em ficheiros próprios, que o browser guarda
  // em cache entre publicações. A base (React e router) separa-se do resto (componentes, OIDC, consultas).
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|scheduler)[\/]/ },
            { name: 'vendor', test: /node_modules[\/]/ },
          ],
        },
      },
    },
  },
  // Lê as variáveis VITE_* do .env da raiz (o mesmo do backend); só essas chegam ao browser.
  envDir: '..',
  server: {
    port: 5173,
    strictPort: true, // o realm Keycloak só aceita redirecionamentos para a porta 5173
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
});
