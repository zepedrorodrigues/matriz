import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnv } from './shared/config/load-env';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const app = await NestFactory.create(AppModule);
  // Mesma origem do frontend: o proxy encaminha /api para o backend (architecture.md §8).
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
