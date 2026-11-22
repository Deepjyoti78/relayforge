import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { withDeadline } from '../../common/deadline';
import { RuntimeConfig } from '../config/config.module';
import { safeError } from '../observability/logging';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly connection: Redis;

  constructor(private readonly config: RuntimeConfig) {
    const rawUrl = config.values.redisUrl || 'redis://127.0.0.1:6379';
    let hostname: string | undefined;
    try {
      hostname = new URL(rawUrl).hostname;
    } catch {
      // ignore
    }
    const isTls = rawUrl.startsWith('rediss://');
    this.connection = new Redis(rawUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
      family: 4,
      keepAlive: 10000,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
      ...(isTls ? { tls: { rejectUnauthorized: false, servername: hostname } } : {}),
      retryStrategy: (attempt) => Math.min(attempt * 250, 3000),
    });

    this.connection.on('error', (error: Error) => {
      this.logger.warn({ event: 'redis_connection_error', error: safeError(error) });
    });
    this.connection.on('close', () => {
      this.logger.warn({ event: 'redis_connection_closed' });
    });
    this.connection.on('reconnecting', (delay: number) => {
      this.logger.log({ event: 'redis_reconnecting', delayMs: delay });
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await withDeadline(this.connection.connect(), 10000);
      try {
        const memory = await withDeadline(this.connection.info('memory'), 2000);
        if (!/^maxmemory_policy:noeviction\r?$/m.test(memory)) {
          this.logger.warn({
            event: 'redis_policy_advisory',
            message: 'Queue storage is not reporting noeviction policy. In production, ensure noeviction is enforced.',
          });
        } else {
          this.logger.log({ event: 'redis_connected', memoryPolicy: 'noeviction' });
        }
      } catch {
        this.logger.log({ event: 'redis_connected' });
      }
    } catch (error) {
      this.logger.warn({
        event: 'redis_connection_advisory',
        message: `${this.config.values.role} started without active Redis connection. Outbox worker and HTTP health server remain active; operational Redis queue will retry in background.`,
        error: safeError(error),
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (this.connection.status === 'ready') {
        await withDeadline(this.connection.quit(), 2000);
      }
    } catch {
      // A lost Redis connection must not prevent process shutdown.
    } finally {
      try {
        this.connection.disconnect();
      } catch {
        // ignore
      }
    }
  }
}
