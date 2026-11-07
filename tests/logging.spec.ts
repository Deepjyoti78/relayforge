import { Writable } from 'node:stream';
import pino from 'pino';
import { parseEnvironment } from '../src/modules/config/environment';
import { httpLoggerOptions, safeError } from '../src/modules/observability/logging';

describe('safe operational logging', () => {
  it('excludes headers, bodies, query parameters, and raw error messages', () => {
    let output = '';
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const options = httpLoggerOptions(parseEnvironment('api', {
      DATABASE_URL: 'postgresql://api:local@localhost/relayforge_test',
    }));
    const logger = pino(options, destination);
    logger.error({
      req: {
        id: 'trusted-id', method: 'POST', url: '/ingest/example?token=query-secret',
        headers: { authorization: 'Bearer header-secret', cookie: 'session=cookie-secret' },
        body: { value: 'nested-body-secret' },
      },
      body: { value: 'body-secret' },
      secret: 'direct-secret',
      err: new Error('postgresql://user:error-secret@host/db'),
    }, 'request failed');
    expect(output).toContain('/ingest/example');
    expect(output).toContain('trusted-id');
    for (const value of ['query-secret', 'header-secret', 'cookie-secret', 'body-secret', 'direct-secret', 'error-secret']) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain('[REDACTED]');
  });

  it('keeps bounded diagnostic codes but excludes arbitrary error content', () => {
    const error = Object.assign(new Error('sensitive connection details'), { code: 'ECONNREFUSED' });
    expect(safeError(error)).toEqual({ type: 'Error', code: 'ECONNREFUSED' });
    expect(safeError(Object.assign(error, { code: 'postgresql://secret@host/db' })))
      .toEqual({ type: 'Error' });
  });
});
