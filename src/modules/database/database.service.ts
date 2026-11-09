import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { RuntimeConfig } from '../config/config.module';
import { safeError } from '../observability/logging';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  readonly client: PrismaClient;

  constructor(config: RuntimeConfig) {
    const isCloudDb = config.values.databaseUrl.includes('supabase.com') || config.values.databaseUrl.includes('pooler');
    const adapter = new PrismaPg({
      connectionString: config.values.databaseUrl,
      max: config.values.databasePoolSize,
      connectionTimeoutMillis: Math.max(config.values.databaseTimeoutMs, 10000),
      query_timeout: Math.max(config.values.databaseTimeoutMs, 10000),
      statement_timeout: Math.max(config.values.databaseTimeoutMs, 10000),
      idleTimeoutMillis: 10000,
      application_name: `relayforge-${config.values.role}`,
      ...(isCloudDb ? { ssl: { rejectUnauthorized: false } } : {}),
    }, {
      onPoolError: (error) => this.logger.error({ event: 'database_pool_error', error: safeError(error) }),
      onConnectionError: (error) => this.logger.error({ event: 'database_connection_error', error: safeError(error) }),
    });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    try {
      const roles = await this.client.$queryRaw<{ unsafe: boolean }[]>`
        SELECT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole) AS unsafe
        FROM pg_roles WHERE rolname = current_user
      `;
      if (roles.length === 1 && roles[0]?.unsafe) {
        this.logger.warn({
          event: 'database_role_advisory',
          message: 'Runtime is operating with administrative database role. In production, ensure dedicated least-privilege credentials are used.',
        });
      }
    } catch {
      this.logger.warn({
        event: 'database_role_advisory',
        message: 'Could not query pg_roles for current_user, continuing with current database connection.',
      });
    }
    this.logger.log({ event: 'database_connected' });
  }

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
