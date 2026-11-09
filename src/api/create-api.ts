import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
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
      if (!origin) return callback(null, true);
      const allowed = [
        config.frontendUrl,
        'https://relayforge-staging-web.onrender.com',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
      ];
      if (
        allowed.some((a) => a && a.toLowerCase() === origin.toLowerCase()) ||
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
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
