import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client';
import { DatabaseService } from './database.service';

@Injectable()
export class TenantContextService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Executes database operations within an isolated transaction scoped to a specific tenant
   * organization and authenticated user.
   *
   * PostgreSQL session variables (app.current_org_id, app.current_user_id) are set with is_local=true.
   * This guarantees that:
   * 1. Row-Level Security (RLS) is strictly enforced at the database engine level.
   * 2. When the transaction commits or rolls back, PostgreSQL automatically resets the settings,
   *    preventing any tenant context leakage across pooled connections.
   */
  async runInTenantContext<T>(
    orgId: string,
    userId: string,
    operation: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.database.client.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_org_id', ${orgId}, true),
               set_config('app.current_user_id', ${userId}, true)
      `;
      return operation(tx as unknown as PrismaClient);
    });
  }

  /**
   * Executes database operations within an isolated transaction scoped to an authenticated user,
   * without an active organization context (e.g. for listing organizations or creating a new organization).
   */
  async runInUserContext<T>(
    userId: string,
    operation: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.database.client.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true),
               set_config('app.current_org_id', '', true)
      `;
      return operation(tx as unknown as PrismaClient);
    });
  }
}
