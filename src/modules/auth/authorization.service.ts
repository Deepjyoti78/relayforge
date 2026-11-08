import { ForbiddenException, Injectable } from '@nestjs/common';
import type { MembershipRole } from '../../generated/prisma/enums';

const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 3,
  DEVELOPER: 2,
  VIEWER: 1,
};

@Injectable()
export class AuthorizationService {
  /**
   * Evaluates if a member's role meets or exceeds the required role in the hierarchy.
   * OWNER (3) > DEVELOPER (2) > VIEWER (1)
   */
  hasRole(memberRole: MembershipRole, requiredRole: MembershipRole): boolean {
    return (ROLE_RANK[memberRole] ?? 0) >= (ROLE_RANK[requiredRole] ?? 0);
  }

  canManageOrg(memberRole: MembershipRole): boolean {
    return memberRole === 'OWNER';
  }

  canManageMembers(memberRole: MembershipRole): boolean {
    return memberRole === 'OWNER';
  }

  canConfigureWorkflows(memberRole: MembershipRole): boolean {
    return this.hasRole(memberRole, 'DEVELOPER');
  }

  canView(memberRole: MembershipRole): boolean {
    return this.hasRole(memberRole, 'VIEWER');
  }

  assertRole(memberRole: MembershipRole, requiredRole: MembershipRole): void {
    if (!this.hasRole(memberRole, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions: requires ${requiredRole}`);
    }
  }

  assertCanManageOrg(memberRole: MembershipRole): void {
    if (!this.canManageOrg(memberRole)) {
      throw new ForbiddenException('Only organization owners can modify organization settings');
    }
  }

  assertCanManageMembers(memberRole: MembershipRole): void {
    if (!this.canManageMembers(memberRole)) {
      throw new ForbiddenException('Only organization owners can manage memberships');
    }
  }

  canManageDestinations(memberRole: MembershipRole): boolean {
    return this.hasRole(memberRole, 'DEVELOPER');
  }

  /**
   * Looks up membership and verifies user belongs to organization.
   */
  async verifyMembership(
    tx: { membership: { findUnique: (args: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => Promise<{ role: MembershipRole } | null> } },
    organizationId: string,
    userId: string,
  ): Promise<{ role: MembershipRole }> {
    const membership = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Organization not found or access denied');
    }
    return membership;
  }
}
