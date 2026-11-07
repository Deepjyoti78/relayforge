import { ForbiddenException } from '@nestjs/common';
import { AuthorizationService } from '../src/modules/auth/authorization.service';

describe('AuthorizationService role hierarchy & permissions', () => {
  let authz: AuthorizationService;

  beforeEach(() => {
    authz = new AuthorizationService();
  });

  describe('role hierarchy', () => {
    it('OWNER satisfies all role requirements', () => {
      expect(authz.hasRole('OWNER', 'OWNER')).toBe(true);
      expect(authz.hasRole('OWNER', 'DEVELOPER')).toBe(true);
      expect(authz.hasRole('OWNER', 'VIEWER')).toBe(true);
    });

    it('DEVELOPER satisfies DEVELOPER and VIEWER requirements', () => {
      expect(authz.hasRole('DEVELOPER', 'OWNER')).toBe(false);
      expect(authz.hasRole('DEVELOPER', 'DEVELOPER')).toBe(true);
      expect(authz.hasRole('DEVELOPER', 'VIEWER')).toBe(true);
    });

    it('VIEWER only satisfies VIEWER requirements', () => {
      expect(authz.hasRole('VIEWER', 'OWNER')).toBe(false);
      expect(authz.hasRole('VIEWER', 'DEVELOPER')).toBe(false);
      expect(authz.hasRole('VIEWER', 'VIEWER')).toBe(true);
    });
  });

  describe('capability checks', () => {
    it('only OWNER can manage org settings', () => {
      expect(authz.canManageOrg('OWNER')).toBe(true);
      expect(authz.canManageOrg('DEVELOPER')).toBe(false);
      expect(authz.canManageOrg('VIEWER')).toBe(false);

      expect(() => authz.assertCanManageOrg('OWNER')).not.toThrow();
      expect(() => authz.assertCanManageOrg('DEVELOPER')).toThrow(ForbiddenException);
      expect(() => authz.assertCanManageOrg('VIEWER')).toThrow(ForbiddenException);
    });

    it('only OWNER can manage members', () => {
      expect(authz.canManageMembers('OWNER')).toBe(true);
      expect(authz.canManageMembers('DEVELOPER')).toBe(false);
      expect(authz.canManageMembers('VIEWER')).toBe(false);

      expect(() => authz.assertCanManageMembers('OWNER')).not.toThrow();
      expect(() => authz.assertCanManageMembers('DEVELOPER')).toThrow(ForbiddenException);
      expect(() => authz.assertCanManageMembers('VIEWER')).toThrow(ForbiddenException);
    });

    it('OWNER and DEVELOPER can configure workflows', () => {
      expect(authz.canConfigureWorkflows('OWNER')).toBe(true);
      expect(authz.canConfigureWorkflows('DEVELOPER')).toBe(true);
      expect(authz.canConfigureWorkflows('VIEWER')).toBe(false);
    });

    it('all roles can view permitted resources', () => {
      expect(authz.canView('OWNER')).toBe(true);
      expect(authz.canView('DEVELOPER')).toBe(true);
      expect(authz.canView('VIEWER')).toBe(true);
    });
  });
});
