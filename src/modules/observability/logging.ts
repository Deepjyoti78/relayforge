import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import type { Environment } from '../config/environment';

export function safeError(error: unknown): { type: string; code?: string } {
  if (!(error instanceof Error)) return { type: 'UnknownError' };
  const code: unknown = 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(code)
    ? { type: error.name, code }
    : { type: error.name };
}

export function httpLoggerOptions(environment: Environment): Options {
  return {
    level: environment.logLevel,
    base: { service: `relayforge-${environment.role}`, version: environment.version },
    genReqId: (_request: IncomingMessage, response: ServerResponse) => {
      // Public callers cannot choose trusted correlation IDs.
      const requestId = randomUUID();
      response.setHeader('x-request-id', requestId);
      return requestId;
    },
    serializers: {
      req: (request: IncomingMessage & { id?: string }) => ({
        id: request.id,
        method: request.method,
        path: request.url?.split('?')[0],
      }),
      res: (response: ServerResponse) => ({ statusCode: response.statusCode }),
      err: safeError,
    },
    redact: {
      paths: [
        'password', 'token', 'secret', 'authorization', 'cookie', 'body', 'payload',
        'databaseUrl', 'redisUrl', 'config', 'env',
        'req.headers.authorization', 'req.headers.cookie', 'req.body',
        'headers.authorization', 'headers.cookie',
        '*.password', '*.token', '*.secret', '*.ciphertext',
      ],
      censor: '[REDACTED]',
    },
  };
}
