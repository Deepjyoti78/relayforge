import 'reflect-metadata';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { exitOnStartupFailure } from '../modules/observability/startup-error';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  // Support cloud environments (e.g. Render free tier) requiring an immediate HTTP health check port
  const workerHttpPort = process.env.WORKER_PORT || (process.env.NODE_ENV === 'production' ? process.env.PORT : undefined);
  if (workerHttpPort) {
    const port = parseInt(workerHttpPort, 10);
    const server = createServer((req, res) => {
      if (req.url === '/health' || req.url === '/healthz' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'relayforge-worker', timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`[Worker Health Server] Listening on port ${port} for cloud health checks`);
    });
  }

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  app.get(Logger).log('[Worker Bootstrap] Worker application context initialized successfully');
}

void bootstrap().catch((error: unknown) => exitOnStartupFailure('worker', error));
