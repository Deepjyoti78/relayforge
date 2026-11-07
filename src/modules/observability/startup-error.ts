import { writeSync } from 'node:fs';
import { ConfigurationError } from '../config/environment';
import { safeError } from './logging';

export function exitOnStartupFailure(role: string, error: unknown): never {
  writeSync(2, `${JSON.stringify({
    level: 'fatal',
    service: `relayforge-${role}`,
    event: 'startup_failed',
    error: safeError(error),
    ...(error instanceof ConfigurationError ? { message: error.message } : {}),
  })}\n`);
  process.exit(1);
}
