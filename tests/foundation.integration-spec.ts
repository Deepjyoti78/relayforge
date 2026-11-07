import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { HeartbeatService } from '../src/worker/heartbeat.service';
import { probeWorker } from '../src/worker/probe';
import { WorkerModule } from '../src/worker/worker.module';

describe('foundation with real PostgreSQL and Redis', () => {
  let api: NestExpressApplication;
  let worker: INestApplicationContext;
  let instanceId: string;
  let workerClosed = false;

  beforeAll(async () => {
    process.env.QUEUE_PREFIX = `relayforge-test-${randomUUID()}`;
    api = await createApiApplication();
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false, abortOnError: false });
    instanceId = worker.get(HeartbeatService).instanceId;
  });

  afterAll(async () => {
    if (!workerClosed) await worker?.close();
    await api?.close();
  });

  it('uses restricted database identities', async () => {
    for (const app of [api, worker]) {
      const roles = await app.get(DatabaseService).client.$queryRaw<{
        rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean;
      }[]>`SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
      expect(roles).toEqual([{ rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false }]);
    }
  });

  it('allows API reads but rejects API writes to operational worker state', async () => {
    const client = api.get(DatabaseService).client;
    const heartbeat = await client.workerHeartbeat.findUnique({ where: { instanceId } });
    expect(heartbeat?.version).toBe('0.1.0');
    await expect(client.workerHeartbeat.create({ data: { instanceId: randomUUID(), version: 'forbidden' } }))
      .rejects.toThrow();
  });

  it('generates correlation IDs and applies security headers', async () => {
    const response = await request(api.getHttpServer()).get('/health/live')
      .set('x-request-id', 'untrusted-client-id').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-request-id']).not.toBe('untrusted-client-id');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps API readiness independent of a worker Redis connection', async () => {
    const redis = worker.get(RedisService).connection;
    redis.disconnect();
    try {
      await request(api.getHttpServer()).get('/health/ready').expect(200);
    } finally {
      await redis.connect();
    }
  });

  it('checks PostgreSQL and the running consumer through a real BullMQ round trip', async () => {
    const result = await probeWorker(worker.get(RuntimeConfig).values);
    expect(result.instanceId).toBe(instanceId);
    expect(result.version).toBe('0.1.0');
  });

  it('removes its own heartbeat on graceful worker shutdown', async () => {
    await worker.close();
    workerClosed = true;
    const heartbeat = await api.get(DatabaseService).client.workerHeartbeat.findUnique({ where: { instanceId } });
    expect(heartbeat).toBeNull();
  });
});
