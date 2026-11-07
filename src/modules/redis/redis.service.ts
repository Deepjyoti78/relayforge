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

  constructor(config: RuntimeConfig) {
    if (!config.values.redisUrl) throw new Error('Worker Redis configuration is missing');
    this.connection = new Redis(config.values.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
    });
    this.connection.on('error', (error: Error) => {
      this.logger.error({ event: 'redis_connection_error', error: safeError(error) });
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await withDeadline(this.connection.connect(), 5000);
      const memory = await withDeadline(this.connection.info('memory'), 2000);
      if (!/^maxmemory_policy:noeviction\r?$/m.test(memory)) {
        const error = new Error('Queue storage must use noeviction');
        Object.assign(error, { code: 'UNSAFE_REDIS_POLICY' });
        throw error;
      }
      this.logger.log({ event: 'redis_connected', memoryPolicy: 'noeviction' });
    } catch (error) {
      this.connection.disconnect();
      throw error;
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
      this.connection.disconnect();
    }
  }
}
