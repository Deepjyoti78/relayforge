import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApiApplication } from '../src/api/create-api';
import { RuntimeConfig } from '../src/modules/config/config.module';

describe('CORS policy used by the API bootstrap', () => {
  let originCheck: (origin: string | undefined, callback: (error: Error | null, allowed: boolean) => void) => void;
  beforeAll(async () => {
    const fakeApp = {
      get: (key: unknown) => key === RuntimeConfig ? { values: { frontendUrl: 'https://app.example.com/dashboard' } } : {},
      useLogger: jest.fn(),
      enableCors: (options: { origin: typeof originCheck }) => { originCheck = options.origin; },
      use: jest.fn(), useBodyParser: jest.fn(), enableShutdownHooks: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
    };
    const spy = jest.spyOn(NestFactory, 'create').mockResolvedValue(fakeApp as unknown as NestExpressApplication);
    try { await createApiApplication(); } finally { spy.mockRestore(); }
  });
  it.each([
    'https://attacker.onrender.com', 'https://attacker.workers.dev', 'https://attacker.pages.dev',
    'http://localhost:5173', 'http://127.0.0.1:5173', 'null',
    'garbage.onrender.com', 'https://app.example.com.attacker.test',
    'http://app.example.com', 'https://app.example.com:8443',
    'https://app.example.com/path', 'https://user@app.example.com',
  ])('does not permit credentials from %s', (origin) => {
    const callback = jest.fn();
    originCheck(origin, callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });
  it('permits the configured frontend origin even when FRONTEND_URL has a path', () => {
    const callback = jest.fn();
    originCheck('https://app.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
  it('preserves nonbrowser clients without an Origin', () => {
    const callback = jest.fn();
    originCheck(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
