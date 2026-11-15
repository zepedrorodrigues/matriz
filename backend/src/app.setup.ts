import { INestApplication } from '@nestjs/common';
import { requestLog, RequestLogSink } from './shared/logging/request-log';

export interface AppOptions {
  /**
   * Regista uma linha por pedido (DT20). Ligado no arranque (main.ts); nos testes de API fica
   * desligado, para não encher o resultado, salvo no teste que o verifica, que passa o seu destino.
   */
  requestLog?: boolean | RequestLogSink;
}

/** Configuração da aplicação partilhada pelo arranque (main.ts) e pelos testes de API. */
export function configureApp(app: INestApplication, options: AppOptions = {}): INestApplication {
  // Mesma origem do frontend: o proxy encaminha /api para o backend (architecture.md §8).
  app.setGlobalPrefix('api');
  if (options.requestLog) app.use(requestLog(options.requestLog === true ? undefined : options.requestLog));
  return app;
}
