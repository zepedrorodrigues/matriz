import { INestApplication } from '@nestjs/common';

/** Configuração da aplicação partilhada pelo arranque (main.ts) e pelos testes de API. */
export function configureApp(app: INestApplication): INestApplication {
  // Mesma origem do frontend: o proxy encaminha /api para o backend (architecture.md §8).
  app.setGlobalPrefix('api');
  return app;
}
