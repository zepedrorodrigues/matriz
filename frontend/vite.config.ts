import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Endereço do backend em desenvolvimento; o servidor do Vite encaminha /api para lá, mantendo a
// mesma origem que o proxy de produção (architecture.md §8). A aplicação usa sempre caminhos /api.
const apiTarget = 'http://localhost:3000'; // PORT do backend no .env.example

export default defineConfig({
  plugins: [react()],
  // Lê as variáveis VITE_* do .env da raiz (o mesmo do backend); só essas chegam ao browser.
  envDir: '..',
  server: {
    port: 5173,
    strictPort: true, // o realm Keycloak só aceita redirecionamentos para a porta 5173
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
});
