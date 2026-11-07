import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ApiModule } from './app.module';

export async function createApiApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
    bufferLogs: true,
    abortOnError: false,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
