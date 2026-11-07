import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret, generateWebhookSecret } from '../../common/crypto';
import { AuthorizationService } from '../auth/authorization.service';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';

export interface CreateEndpointInput {
  name: string;
  slug?: string;
}

export interface EndpointDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  secretPreview: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndpointWithSecretDto {
  endpoint: EndpointDto;
  signingSecret: string;
}

interface RawEndpointRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  is_active: boolean;
}

@Injectable()
export class EndpointService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly authz: AuthorizationService,
    private readonly config: RuntimeConfig,
  ) {}

  /**
   * Creates a new ingestion endpoint with an encrypted webhook signing secret.
   * Only OWNER and DEVELOPER roles can create endpoints.
   */
  async createEndpoint(
    organizationId: string,
    userId: string,
    input: CreateEndpointInput,
  ): Promise<EndpointWithSecretDto> {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 128) {
      throw new BadRequestException('Endpoint name must be between 2 and 128 characters.');
    }

    let slug = input.slug?.trim().toLowerCase();
    if (slug) {
      if (!/^[a-z0-9][a-z0-9_-]{1,127}$/.test(slug)) {
        throw new BadRequestException(
          'Slug must contain only lowercase alphanumeric characters, dashes, or underscores.',
        );
      }
    } else {
      const sanitized = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      slug = `${sanitized || 'endpoint'}-${randomUUID().slice(0, 8)}`;
    }

    const { rawSecret, secretPreview } = generateWebhookSecret();
    const { ciphertext, iv, tag } = encryptSecret(rawSecret, this.config.values.encryptionKey);

    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      // Check unique slug within organization
      const existing = await tx.endpoint.findUnique({
        where: {
          organizationId_slug: { organizationId, slug },
        },
      });

      if (existing) {
        throw new BadRequestException(`An endpoint with slug '${slug}' already exists in this organization.`);
      }

      const created = await tx.endpoint.create({
        data: {
          organizationId,
          name: trimmedName,
          slug,
          secretCiphertext: ciphertext,
          secretIv: iv,
          secretTag: tag,
          secretPreview,
          isActive: true,
        },
      });

      return {
        endpoint: {
          id: created.id,
          organizationId: created.organizationId,
          name: created.name,
          slug: created.slug,
          secretPreview: created.secretPreview,
          isActive: created.isActive,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        signingSecret: rawSecret,
      };
    });
  }

  /**
   * Lists all endpoints for an organization.
   * Excludes ciphertext and auth tags, returning only safe metadata and secret preview.
   */
  async listEndpoints(organizationId: string, userId: string): Promise<EndpointDto[]> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      const endpoints = await tx.endpoint.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      return endpoints.map((ep) => ({
        id: ep.id,
        organizationId: ep.organizationId,
        name: ep.name,
        slug: ep.slug,
        secretPreview: ep.secretPreview,
        isActive: ep.isActive,
        createdAt: ep.createdAt,
        updatedAt: ep.updatedAt,
      }));
    });
  }

  /**
   * Deactivates or removes an endpoint.
   * Requires OWNER or DEVELOPER role.
   */
  async deleteEndpoint(
    organizationId: string,
    userId: string,
    endpointId: string,
  ): Promise<{ success: boolean }> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      const endpoint = await tx.endpoint.findFirst({
        where: { id: endpointId, organizationId },
      });

      if (!endpoint) {
        throw new NotFoundException('Endpoint not found.');
      }

      await tx.endpoint.delete({
        where: { id: endpointId },
      });

      return { success: true };
    });
  }

  /**
   * Rotates the signing secret for an endpoint.
   * Generates a new secret, re-encrypts it, and returns the new raw secret once.
   */
  async rotateSecret(
    organizationId: string,
    userId: string,
    endpointId: string,
  ): Promise<EndpointWithSecretDto> {
    const { rawSecret, secretPreview } = generateWebhookSecret();
    const { ciphertext, iv, tag } = encryptSecret(rawSecret, this.config.values.encryptionKey);

    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      this.authz.assertRole(membership.role, 'DEVELOPER');

      const endpoint = await tx.endpoint.findFirst({
        where: { id: endpointId, organizationId },
      });

      if (!endpoint) {
        throw new NotFoundException('Endpoint not found.');
      }

      const updated = await tx.endpoint.update({
        where: { id: endpointId },
        data: {
          secretCiphertext: ciphertext,
          secretIv: iv,
          secretTag: tag,
          secretPreview,
        },
      });

      return {
        endpoint: {
          id: updated.id,
          organizationId: updated.organizationId,
          name: updated.name,
          slug: updated.slug,
          secretPreview: updated.secretPreview,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
        signingSecret: rawSecret,
      };
    });
  }

  /**
   * Trusted database lookup for ingestion verification.
   * Uses SECURITY DEFINER function to verify endpoint status and fetch ciphertext.
   */
  async getEndpointForIngestion(endpointId: string): Promise<{
    id: string;
    organizationId: string;
    name: string;
    signingSecret: string;
  } | null> {
    const result = await this.database.client.$queryRaw<RawEndpointRow[]>`
      SELECT * FROM get_endpoint_for_ingestion(${endpointId}::uuid)
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    const signingSecret = decryptSecret(
      row.secret_ciphertext,
      row.secret_iv,
      row.secret_tag,
      this.config.values.encryptionKey,
    );

    return {
      id: row.id,
      organizationId: row.org_id,
      name: row.name,
      signingSecret,
    };
  }
}
