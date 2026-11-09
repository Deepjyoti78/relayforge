import { writeSync } from 'node:fs';
import { safeError } from './logging';

export function exitOnStartupFailure(role: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[FATAL STARTUP ERROR: ${role}]`, message, stack);
  writeSync(2, `${JSON.stringify({
    level: 'fatal',
    service: `relayforge-${role}`,
    event: 'startup_failed',
    error: safeError(error),
    message,
    stack,
  })}\n`);
  process.exit(1);
}
