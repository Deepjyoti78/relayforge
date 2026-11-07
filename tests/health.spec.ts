import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { parseEnvironment } from '../src/modules/config/environment';
import { DatabaseService } from '../src/modules/database/database.service';
import { HealthController } from '../src/modules/health/health.controller';

describe('liveness versus dependency readiness', () => {
  let app: INestApplication<Server>;
  const ping = jest.fn(() => Promise.resolve());

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DatabaseService, useValue: { ping } },
        { provide: RuntimeConfig, useValue: new RuntimeConfig(parseEnvironment('api', {
          DATABASE_URL: 'postgresql://api:local@localhost/relayforge_test',
        })) },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => ping.mockReset().mockResolvedValue(undefined));

  it('keeps liveness independent of PostgreSQL', async () => {
    ping.mockRejectedValue(new Error('database down'));
    await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports PostgreSQL readiness', async () => {
    await request(app.getHttpServer()).get('/health/ready')
      .expect(200, { status: 'ok', checks: { postgres: 'ok' } });
  });

  it('fails readiness without exposing internal connection errors', async () => {
    ping.mockRejectedValue(new Error('postgresql://private-password@internal-host/db'));
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(response.text).not.toContain('private-password');
    expect(response.text).not.toContain('internal-host');
    expect(response.body).toEqual({ status: 'unavailable', checks: { postgres: 'unavailable' } });
  });
});
