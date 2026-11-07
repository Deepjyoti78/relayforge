import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { validateDestinationUrl } from '../../common/security/ssrf.validator';
import { AuthorizationService } from '../auth/authorization.service';
import { RuntimeConfig } from '../config/config.module';
import { TenantContextService } from '../database/tenant-context.service';

export interface CreateDestinationInput {
  name: string;
  url: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  rateLimitPerSecond?: number;
  timeoutMs?: number;
}

export interface UpdateDestinationInput {
  name?: string;
  url?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  rateLimitPerSecond?: number;
  timeoutMs?: number;
  isActive?: boolean;
}

export interface DestinationDto {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  httpMethod: string;
  headers: Record<string, string> | null;
  rateLimitPerSecond: number;
  timeoutMs: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH']);

@Injectable()
export class DestinationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly authz: AuthorizationService,
    private readonly config: RuntimeConfig,
  ) {}

  /**
   * Registers a new destination endpoint with full SSRF validation.
   * Only OWNER and DEVELOPER roles can create destinations.
   */
  async createDestination(
    organizationId: string,
    userId: string,
    input: CreateDestinationInput,
  ): Promise<DestinationDto> {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 128) {
      throw new BadRequestException('Destination name must be between 2 and 128 characters.');
    }

    const trimmedUrl = input.url?.trim();
    if (!trimmedUrl) {
      throw new BadRequestException('Destination URL is required.');
    }

    // SSRF validation
    await validateDestinationUrl(trimmedUrl, {
      allowPrivate: this.config.values.allowPrivateDestinations,
    });

    const httpMethod = (input.httpMethod?.trim().toUpperCase() || 'POST');
    if (!ALLOWED_HTTP_METHODS.has(httpMethod)) {
      throw new BadRequestException(`HTTP method '${httpMethod}' is not supported. Use POST, PUT, or PATCH.`);
    }

    const rateLimit = input.rateLimitPerSecond ?? 50;
    if (typeof rateLimit !== 'number' || rateLimit < 1 || rateLimit > 5000) {
      throw new BadRequestException('Rate limit must be an integer between 1 and 5000 requests/sec.');
    }

    const timeout = input.timeoutMs ?? 10000;
    if (typeof timeout !== 'number' || timeout < 500 || timeout > 60000) {
      throw new BadRequestException('Timeout must be between 500ms and 60,000ms.');
    }

    let parsedHeaders: Prisma.InputJsonValue | undefined;
    if (input.headers !== undefined && input.headers !== null) {
      if (typeof input.headers !== 'object' || Array.isArray(input.headers)) {
        throw new BadRequestException('Headers must be a key-value object of strings.');
      }
      for (const [key, val] of Object.entries(input.headers)) {
        if (typeof key !== 'string' || typeof val !== 'string') {
          throw new BadRequestException('All header keys and values must be strings.');
        }
      }
      parsedHeaders = input.headers as unknown as Prisma.InputJsonValue;
    }

    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      const created = await tx.destination.create({
        data: {
          organizationId,
          name: trimmedName,
          url: trimmedUrl,
          httpMethod,
          rateLimitPerSecond: rateLimit,
          timeoutMs: timeout,
          isActive: true,
          ...(parsedHeaders !== undefined ? { headers: parsedHeaders } : {}),
        },
      });

      return this.mapToDto(created);
    });
  }

  /**
   * Lists all destination targets registered for an organization.
   */
  async listDestinations(
    organizationId: string,
    userId: string,
  ): Promise<DestinationDto[]> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      const records = await tx.destination.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.mapToDto(r));
    });
  }

  /**
   * Retrieves a single destination target by ID.
   */
  async getDestination(
    organizationId: string,
    userId: string,
    destinationId: string,
  ): Promise<DestinationDto> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      const record = await tx.destination.findFirst({
        where: { id: destinationId, organizationId },
      });

      if (!record) {
        throw new NotFoundException('Destination not found.');
      }

      return this.mapToDto(record);
    });
  }

  /**
   * Updates an existing destination target.
   * Only OWNER and DEVELOPER roles can update destinations.
   */
  async updateDestination(
    organizationId: string,
    userId: string,
    destinationId: string,
    input: UpdateDestinationInput,
  ): Promise<DestinationDto> {
    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 128) {
        throw new BadRequestException('Destination name must be between 2 and 128 characters.');
      }
    }

    let trimmedUrl: string | undefined;
    if (input.url !== undefined) {
      trimmedUrl = input.url.trim();
      if (!trimmedUrl) {
        throw new BadRequestException('Destination URL cannot be empty.');
      }
      await validateDestinationUrl(trimmedUrl, {
        allowPrivate: this.config.values.allowPrivateDestinations,
      });
    }

    let httpMethod: string | undefined;
    if (input.httpMethod !== undefined) {
      httpMethod = input.httpMethod.trim().toUpperCase();
      if (!ALLOWED_HTTP_METHODS.has(httpMethod)) {
        throw new BadRequestException(`HTTP method '${httpMethod}' is not supported. Use POST, PUT, or PATCH.`);
      }
    }

    if (input.rateLimitPerSecond !== undefined) {
      if (
        typeof input.rateLimitPerSecond !== 'number'
        || input.rateLimitPerSecond < 1
        || input.rateLimitPerSecond > 5000
      ) {
        throw new BadRequestException('Rate limit must be an integer between 1 and 5000 requests/sec.');
      }
    }

    if (input.timeoutMs !== undefined) {
      if (
        typeof input.timeoutMs !== 'number'
        || input.timeoutMs < 500
        || input.timeoutMs > 60000
      ) {
        throw new BadRequestException('Timeout must be between 500ms and 60,000ms.');
      }
    }

    let parsedHeaders: Prisma.InputJsonValue | undefined;
    if (input.headers !== undefined && input.headers !== null) {
      if (typeof input.headers !== 'object' || Array.isArray(input.headers)) {
        throw new BadRequestException('Headers must be a key-value object of strings.');
      }
      for (const [key, val] of Object.entries(input.headers)) {
        if (typeof key !== 'string' || typeof val !== 'string') {
          throw new BadRequestException('All header keys and values must be strings.');
        }
      }
      parsedHeaders = input.headers as unknown as Prisma.InputJsonValue;
    }

    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      const existing = await tx.destination.findFirst({
        where: { id: destinationId, organizationId },
      });

      if (!existing) {
        throw new NotFoundException('Destination not found.');
      }

      const updateData: Prisma.DestinationUpdateInput = {};
      if (trimmedName !== undefined) updateData.name = trimmedName;
      if (trimmedUrl !== undefined) updateData.url = trimmedUrl;
      if (httpMethod !== undefined) updateData.httpMethod = httpMethod;
      if (parsedHeaders !== undefined) updateData.headers = parsedHeaders;
      if (input.rateLimitPerSecond !== undefined) updateData.rateLimitPerSecond = input.rateLimitPerSecond;
      if (input.timeoutMs !== undefined) updateData.timeoutMs = input.timeoutMs;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const updated = await tx.destination.update({
        where: { id: destinationId },
        data: updateData,
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Deletes a destination target.
   * Only OWNER and DEVELOPER roles can delete destinations.
   */
  async deleteDestination(
    organizationId: string,
    userId: string,
    destinationId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      const existing = await tx.destination.findFirst({
        where: { id: destinationId, organizationId },
      });

      if (!existing) {
        throw new NotFoundException('Destination not found.');
      }

      await tx.destination.delete({
        where: { id: destinationId },
      });

      return { success: true, id: destinationId };
    });
  }

  private mapToDto(record: {
    id: string;
    organizationId: string;
    name: string;
    url: string;
    httpMethod: string;
    headers: unknown;
    rateLimitPerSecond: number;
    timeoutMs: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): DestinationDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      url: record.url,
      httpMethod: record.httpMethod,
      headers: (record.headers as Record<string, string>) || null,
      rateLimitPerSecond: record.rateLimitPerSecond,
      timeoutMs: record.timeoutMs,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
