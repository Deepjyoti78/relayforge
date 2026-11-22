import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { isTrustedFrontendOrigin } from '../modules/auth/browser-security';
import { ApiModule } from './app.module';
import { RuntimeConfig } from '../modules/config/config.module';

export async function createApiApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
    bufferLogs: true,
    abortOnError: false,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(RuntimeConfig).values;
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, !origin || isTrustedFrontendOrigin(origin, config.frontendUrl));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-request-id',
    ],
    exposedHeaders: ['x-request-id'],
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
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
