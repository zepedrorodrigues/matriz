import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadRootEnv } from './shared/config/load-env';
import { createAppLogger } from './shared/logging/app-logger';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  // Registos estruturados (DT20): JSON em produção, texto no desenvolvimento (LOG_FORMAT).
  const app = configureApp(await NestFactory.create(AppModule, { logger: createAppLogger() }), { requestLog: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
