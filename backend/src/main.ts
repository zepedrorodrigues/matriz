import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadRootEnv } from './shared/config/load-env';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
