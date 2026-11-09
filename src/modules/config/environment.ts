import { createHash } from 'node:crypto';
import { z } from 'zod';

export type ProcessRole = 'api' | 'worker';

const databaseUrl = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return ['postgresql:', 'postgres:'].includes(url.protocol)
      && url.hostname.length > 0 && url.pathname.length > 1 && url.username.length > 0;
  } catch { return false; }
}, 'Expected a PostgreSQL connection URL');

const redisUrl = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  let s = val.trim().replace(/^[\"']|[\"']$/g, '').trim();
  if (!s) return undefined;
  const matchCli = s.match(/-u\s+([^\s]+)/);
  if (matchCli && matchCli[1]) s = matchCli[1];
  if (!/^rediss?:\/\//i.test(s)) {
    if (s.startsWith('default:')) {
      s = `rediss://${s}`;
    } else {
      s = `rediss://default:${s}`;
    }
  } else if (s.startsWith('redis://') && s.includes('upstash.io')) {
    s = s.replace(/^redis:\/\//, 'rediss://');
  }
  return s;
}, z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return ['redis:', 'rediss:'].includes(url.protocol)
      && /^\/(\d+)?$/.test(url.pathname || '/');
  } catch { return false; }
}, 'Expected a Redis connection URL with a numeric database'));

const DEFAULT_INSECURE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEFAULT_INSECURE_GITHUB_CLIENT_ID = 'gh_placeholder_client_id';
const DEFAULT_INSECURE_GITHUB_CLIENT_SECRET = 'gh_placeholder_client_secret';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().regex(/^[a-zA-Z0-9.+_-]{1,64}$/).default('0.1.0'),
  HOST: z.string().min(1).max(255).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(20).default(5),
  DATABASE_TIMEOUT_MS: z.coerce.number().int().min(500).max(10000).default(2000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  WORKER_HEARTBEAT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  QUEUE_PREFIX: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default('relayforge'),
  GITHUB_CLIENT_ID: z.string().default(DEFAULT_INSECURE_GITHUB_CLIENT_ID),
  GITHUB_CLIENT_SECRET: z.string().default(DEFAULT_INSECURE_GITHUB_CLIENT_SECRET),
  GITHUB_CALLBACK_URL: z.string().url().default('http://127.0.0.1:3100/auth/github/callback'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().default('rf_session'),
  ENCRYPTION_KEY: z.string().default(DEFAULT_INSECURE_ENCRYPTION_KEY),
  ALLOW_PRIVATE_DESTINATIONS: z.preprocess(
    (val) => val === 'true' || val === true || val === '1' || val === 1,
    z.boolean().default(false),
  ),
});

export class ConfigurationError extends Error {
  readonly code = 'INVALID_CONFIGURATION';
}

export function parseEnvironment(role: ProcessRole, input: NodeJS.ProcessEnv) {
  const roleSchema = (role === 'api'
    ? baseSchema.extend({ DATABASE_URL: databaseUrl, REDIS_URL: redisUrl.optional() })
    : baseSchema.extend({ WORKER_DATABASE_URL: databaseUrl, REDIS_URL: redisUrl })
  ).superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.ENCRYPTION_KEY === DEFAULT_INSECURE_ENCRYPTION_KEY || data.ENCRYPTION_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENCRYPTION_KEY'],
          message: 'Production requires a secure ENCRYPTION_KEY of at least 32 characters',
        });
      }
      if (data.GITHUB_CLIENT_ID === DEFAULT_INSECURE_GITHUB_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_CLIENT_ID'],
          message: 'Production requires a valid GITHUB_CLIENT_ID',
        });
      }
      if (data.GITHUB_CLIENT_SECRET === DEFAULT_INSECURE_GITHUB_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_CLIENT_SECRET'],
          message: 'Production requires a valid GITHUB_CLIENT_SECRET',
        });
      }
      if (data.ALLOW_PRIVATE_DESTINATIONS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ALLOW_PRIVATE_DESTINATIONS'],
          message: 'Private destinations cannot be allowed in production',
        });
      }
    }
  });

  const result = roleSchema.safeParse(input);

  if (!result.success) {
    // Validation diagnostics must never include supplied values or connection strings.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new ConfigurationError(`Invalid or missing configuration: ${fields.join(', ')}`);
  }

  const values = result.data;
  return Object.freeze({
    role,
    environment: values.NODE_ENV,
    version: values.APP_VERSION,
    host: values.HOST,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    databaseUrl: role === 'api' ? input.DATABASE_URL! : input.WORKER_DATABASE_URL!,
    redisUrl: values.REDIS_URL ? String(values.REDIS_URL) : undefined,
    databasePoolSize: values.DATABASE_POOL_SIZE,
    databaseTimeoutMs: values.DATABASE_TIMEOUT_MS,
    workerConcurrency: values.WORKER_CONCURRENCY,
    workerHeartbeatMs: values.WORKER_HEARTBEAT_MS,
    queuePrefix: values.QUEUE_PREFIX,
    githubClientId: values.GITHUB_CLIENT_ID,
    githubClientSecret: values.GITHUB_CLIENT_SECRET,
    githubCallbackUrl: values.GITHUB_CALLBACK_URL,
    frontendUrl: values.FRONTEND_URL,
    sessionCookieName: values.SESSION_COOKIE_NAME,
    encryptionKey: createHash('sha256').update(values.ENCRYPTION_KEY).digest(),
    allowPrivateDestinations: Boolean(values.ALLOW_PRIVATE_DESTINATIONS),
  });
}

export type Environment = ReturnType<typeof parseEnvironment>;
