import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type { MembershipRole } from '../../generated/prisma/enums';
import type { User } from '../../generated/prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface AddMemberInput {
  email?: string;
  username?: string;
  role: MembershipRole;
}

export interface UpdateMemberInput {
  role: MembershipRole;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly authz: AuthorizationService,
  ) {}

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    const suffix = randomBytes(4).toString('hex');
    return `${base || 'org'}-${suffix}`;
  }

  /**
   * Creates an organization and automatically provisions the creator as its OWNER.
   * Runs in user context with transaction isolation.
   */
  async createOrganization(user: User, input: CreateOrganizationInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Organization name is required');
    }

    const orgId = randomUUID();
    const slug = input.slug?.trim() || this.slugify(input.name);

    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      // Create organization
      const org = await tx.organization.create({
        data: {
          id: orgId,
          name: input.name.trim(),
          slug,
          createdBy: user.id,
        },
      });

      // Assign creator as OWNER
      const membership = await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: membership.role,
        createdAt: org.createdAt,
      };
    });
  }

  /**
   * Lists all organizations where the user has an active membership.
   */
  async listUserOrganizations(user: User) {
    return this.tenantContext.runInUserContext(user.id, async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId: user.id },
        include: {
          organization: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        createdAt: m.organization.createdAt,
      }));
    });
  }

  /**
   * Gets details for a specific organization, ensuring tenant isolation.
   */
  async getOrganization(orgId: string, user: User) {
    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: user.id,
          },
        },
        include: { organization: true },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found');
      }

      return {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
        createdAt: membership.organization.createdAt,
        updatedAt: membership.organization.updatedAt,
      };
    });
  }

  /**
   * Updates organization details (name). Requires OWNER role.
   */
  async updateOrganization(orgId: string, user: User, input: UpdateOrganizationInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Organization name cannot be empty');
    }

    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!currentMember) throw new NotFoundException('Organization not found');
      this.authz.assertCanManageOrg(currentMember.role);

      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { name: input.name.trim() },
      });

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Lists all members of the organization. Requires at least VIEWER role.
   */
  async listMembers(orgId: string, user: User) {
    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!currentMember) throw new NotFoundException('Organization not found');

      const members = await tx.membership.findMany({
        where: { organizationId: orgId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });

      return members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      }));
    });
  }

  /**
   * Adds an already registered user to the organization. Requires OWNER role.
   */
  async addMember(orgId: string, user: User, input: AddMemberInput) {
    const role = input.role || 'VIEWER';

    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!currentMember) throw new NotFoundException('Organization not found');
      this.authz.assertCanManageMembers(currentMember.role);

      // Locate target registered user by email or GitHub username
      let targetUser: User | null = null;
      if (input.email) {
        targetUser = await this.database.client.user.findFirst({
          where: { email: input.email.trim() },
        });
      } else if (input.username) {
        const identity = await this.database.client.externalIdentity.findFirst({
          where: { providerUsername: input.username.trim() },
          include: { user: true },
        });
        targetUser = identity?.user ?? null;
      }

      if (!targetUser) {
        throw new BadRequestException('User not found. They must first sign in to RelayForge with GitHub.');
      }

      // Check if already a member
      const existing = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: targetUser.id,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('User is already a member of this organization');
      }

      const membership = await tx.membership.create({
        data: {
          organizationId: orgId,
          userId: targetUser.id,
          role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      return {
        id: membership.id,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.createdAt,
        user: membership.user,
      };
    });
  }

  /**
   * Changes a member's role.
   * Prevents demoting the final Owner. Requires OWNER role.
   */
  async updateMemberRole(orgId: string, memberId: string, user: User, input: UpdateMemberInput) {
    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!currentMember) throw new NotFoundException('Organization not found');
      this.authz.assertCanManageMembers(currentMember.role);

      const targetMember = await tx.membership.findUnique({
        where: { id: memberId },
      });

      if (!targetMember || targetMember.organizationId !== orgId) {
        throw new NotFoundException('Member not found');
      }

      // Check final Owner protection: cannot demote the only Owner
      if (targetMember.role === 'OWNER' && input.role !== 'OWNER') {
        const ownerCount = await tx.membership.count({
          where: { organizationId: orgId, role: 'OWNER' },
        });

        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot demote the final Owner of the organization');
        }
      }

      const updated = await tx.membership.update({
        where: { id: memberId },
        data: { role: input.role },
      });

      return {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Removes a member from an organization.
   * Prevents removal of the final Owner.
   */
  async removeMember(orgId: string, memberId: string, user: User) {
    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!currentMember) throw new NotFoundException('Organization not found');

      const targetMember = await tx.membership.findUnique({
        where: { id: memberId },
      });

      if (!targetMember || targetMember.organizationId !== orgId) {
        throw new NotFoundException('Member not found');
      }

      // User must be an OWNER or removing themselves
      const isSelfRemoval = targetMember.userId === user.id;
      if (!isSelfRemoval && !this.authz.canManageMembers(currentMember.role)) {
        throw new ForbiddenException('Only owners can remove other members');
      }

      // Check final Owner protection: cannot remove the only Owner
      if (targetMember.role === 'OWNER') {
        const ownerCount = await tx.membership.count({
          where: { organizationId: orgId, role: 'OWNER' },
        });

        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot remove the final Owner of the organization');
        }
      }

      await tx.membership.delete({
        where: { id: memberId },
      });

      return { success: true };
    });
  }
  /**
   * Permanently deletes an organization and all its cascaded entities.
   * Requires OWNER role (MANAGE_ORG_SETTINGS).
   */
  async deleteOrganization(orgId: string, user: User) {
    return this.tenantContext.runInTenantContext(orgId, user.id, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });

      if (!membership) throw new NotFoundException('Organization not found');

      this.authz.assertCanManageOrg(membership.role);

      await tx.organization.delete({
        where: { id: orgId },
      });

      return { success: true };
    });
  }
}
