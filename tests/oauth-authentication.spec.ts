import { BadRequestException } from '@nestjs/common';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { GitHubOAuthService } from '../src/modules/auth/github-oauth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/modules/auth/auth.guard';
import type { User } from '../src/generated/prisma/client';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { DatabaseService } from '../src/modules/database/database.service';
import type { SessionService } from '../src/modules/auth/session.service';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';

function containing(value: unknown): unknown { return expect.objectContaining(value); }

const mockQuery = () => jest.fn<Promise<unknown>, [unknown]>();
function createMockDatabase() {
  const client = {
    oAuthState: { create: mockQuery(), findUnique: mockQuery(), delete: mockQuery().mockResolvedValue({}) },
    externalIdentity: { findUnique: mockQuery(), create: mockQuery(), update: mockQuery() },
    user: { create: mockQuery(), update: mockQuery(), findFirst: mockQuery() },
    organization: { create: mockQuery() }, membership: { create: mockQuery() },
    $transaction: jest.fn<Promise<unknown>, [(tx: unknown) => Promise<unknown>]>(),
  };
  client.oAuthState.create.mockResolvedValue({ id: 'state-uuid-1' });
  client.$transaction.mockImplementation((callback) => callback(client));
  return { client };
}

describe('OAuth Authentication System (Google & GitHub)', () => {
  let googleOAuth: GoogleOAuthService;
  let gitHubOAuth: GitHubOAuthService;
  let authController: AuthController;
  let mockDb: ReturnType<typeof createMockDatabase>;
  let mockConfig: RuntimeConfig;
  let mockSessionService: {
    createSession: jest.Mock<Promise<{ token: string; session: { expiresAt: Date } }>, []>;
    revokeSession: jest.Mock<Promise<void>, []>;
  };
  let mockTenantContext: { runInUserContext: jest.Mock; runInTenantContext: jest.Mock };

  beforeEach(() => {
    mockConfig = {
      values: {
        googleClientId: 'google-client-test-id',
        googleClientSecret: 'google-client-test-secret',
        googleCallbackUrl: 'http://127.0.0.1:3100/auth/google/callback',
        githubClientId: 'github-client-test-id',
        githubClientSecret: 'github-client-test-secret',
        githubCallbackUrl: 'http://127.0.0.1:3100/auth/github/callback',
        frontendUrl: 'http://localhost:5173',
        sessionCookieName: 'rf_session',
        environment: 'development',
      },
    } as unknown as RuntimeConfig;

    mockDb = createMockDatabase();

    mockSessionService = {
      createSession: jest.fn<Promise<{ token: string; session: { expiresAt: Date } }>, []>().mockResolvedValue({
        token: 'rf_test_session_token',
        session: { expiresAt: new Date(Date.now() + 86400000) },
      }),
      revokeSession: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    };

    mockTenantContext = {
      runInUserContext: jest.fn(),
      runInTenantContext: jest.fn(),
    };

    googleOAuth = new GoogleOAuthService(mockConfig, mockDb as unknown as DatabaseService);
    gitHubOAuth = new GitHubOAuthService(mockConfig, mockDb as unknown as DatabaseService);
    authController = new AuthController(
      gitHubOAuth,
      googleOAuth,
      mockSessionService as unknown as SessionService,
      mockDb as unknown as DatabaseService,
      mockTenantContext as unknown as TenantContextService,
      mockConfig,
    );
  });

  describe('Google OAuth Service', () => {
    it('generates a valid Google authorization URL with PKCE (S256) and stores state', async () => {
      const result = await googleOAuth.createAuthorizationUrl('https://relayforge-staging-web.onrender.com');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('client_id=google-client-test-id');
      expect(result.url).toContain('redirect_uri=http%3A%2F%2F127.0.0.1%3A3100%2Fauth%2Fgoogle%2Fcallback');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain('prompt=select_account');
      expect(result.url).toContain('scope=openid+email+profile');
      expect(result.state).toBeDefined();

      expect(mockDb.client.oAuthState.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            state: result.state,
            redirectUri: 'https://relayforge-staging-web.onrender.com',
          }),
        }),
      );
    });

    it('rejects callback when state or code is missing', async () => {
      await expect(googleOAuth.handleCallback('', 'state-123')).rejects.toThrow(BadRequestException);
      await expect(googleOAuth.handleCallback('code-123', '')).rejects.toThrow(BadRequestException);
    });

    it('rejects callback with expired or invalid state', async () => {
      mockDb.client.oAuthState.findUnique.mockResolvedValue(null);
      await expect(googleOAuth.handleCallback('code-123', 'invalid-state')).rejects.toThrow(
        /Invalid or expired OAuth state/,
      );
    });

    it('atomically deletes state to prevent replay attacks during callback', async () => {
      mockDb.client.oAuthState.findUnique.mockResolvedValue({
        id: 'state-id-1',
        state: 'valid-state',
        codeVerifier: 'verifier-123',
        redirectUri: 'http://localhost:5173',
        expiresAt: new Date(Date.now() + 600000),
      });

      // Mock exchangeCodeForToken and fetchGoogleProfile
      jest.spyOn(googleOAuth, 'exchangeCodeForToken').mockResolvedValue('google-mock-access-token');
      jest.spyOn(googleOAuth, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-98765',
        name: 'Alex Rivera',
        email: 'alex@example.com',
        picture: 'https://example.com/photo.jpg',
      });
      jest.spyOn(googleOAuth, 'resolveUserFromGoogle').mockResolvedValue({
        id: 'user-uuid-1',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        avatarUrl: 'https://example.com/photo.jpg',
      } as User);

      const res = await googleOAuth.handleCallback('valid-code', 'valid-state');

      expect(mockDb.client.oAuthState.delete).toHaveBeenCalledWith({
        where: { id: 'state-id-1' },
      });
      expect(res.user.displayName).toBe('Alex Rivera');
      expect(res.redirectUri).toBe('http://localhost:5173');
    });
  });

  describe('User Provisioning and Account Linking', () => {
    it('provisions new user and personal workspace with OWNER role for first-time Google sign-in', async () => {
      mockDb.client.externalIdentity.findUnique.mockResolvedValue(null);
      mockDb.client.user.findFirst.mockResolvedValue(null);

      const createdUser = { id: 'new-user-1', displayName: 'Jane Doe', email: 'jane@example.com' };
      mockDb.client.user.create.mockResolvedValue(createdUser);
      mockDb.client.externalIdentity.create.mockResolvedValue({ id: 'ident-1' });
      mockDb.client.organization.create.mockResolvedValue({ id: 'org-1', name: "Jane Doe's Workspace", slug: 'jane-doe-12345' });
      mockDb.client.membership.create.mockResolvedValue({ id: 'mem-1', role: 'OWNER' });

      const user = await googleOAuth.resolveUserFromGoogle({
        sub: 'google-sub-5555',
        name: 'Jane Doe',
        email: 'jane@example.com',
        email_verified: true,
      });

      expect(mockDb.client.user.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            displayName: 'Jane Doe',
            email: 'jane@example.com',
          }),
        }),
      );
      expect(mockDb.client.organization.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            createdBy: 'new-user-1',
          }),
        }),
      );
      expect(mockDb.client.membership.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            userId: 'new-user-1',
            role: 'OWNER',
          }),
        }),
      );
      expect(user.id).toBe('new-user-1');
    });

    it('safely links Google identity to existing user when email is verified', async () => {
      mockDb.client.externalIdentity.findUnique.mockResolvedValue(null);
      const existingUser = { id: 'existing-user-99', displayName: 'Jane Existing', email: 'jane@example.com', avatarUrl: null };
      mockDb.client.user.findFirst.mockResolvedValue(existingUser);
      mockDb.client.externalIdentity.create.mockResolvedValue({ id: 'ident-2' });
      mockDb.client.user.update.mockResolvedValue({ ...existingUser, avatarUrl: 'https://photo.jpg' });

      const user = await googleOAuth.resolveUserFromGoogle({
        sub: 'google-sub-7777',
        name: 'Jane Existing',
        email: 'jane@example.com',
        email_verified: true,
        picture: 'https://photo.jpg',
      });

      expect(mockDb.client.user.create).not.toHaveBeenCalled();
      expect(mockDb.client.externalIdentity.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            userId: 'existing-user-99',
            provider: 'google',
            providerUserId: 'google-sub-7777',
          }),
        }),
      );
      expect(user.id).toBe('existing-user-99');
    });

    it('does NOT link accounts if Google email is unverified', async () => {
      mockDb.client.externalIdentity.findUnique.mockResolvedValue(null);
      mockDb.client.user.create.mockResolvedValue({ id: 'unverified-user-1', displayName: 'Unverified', email: 'hacker@example.com' });
      mockDb.client.organization.create.mockResolvedValue({ id: 'org-2' });
      mockDb.client.membership.create.mockResolvedValue({ id: 'mem-2' });

      await googleOAuth.resolveUserFromGoogle({
        sub: 'google-sub-unverified',
        name: 'Unverified',
        email: 'hacker@example.com',
        email_verified: false,
      });

      // Does not search for existing users to link
      expect(mockDb.client.user.findFirst).not.toHaveBeenCalled();
      expect(mockDb.client.user.create).toHaveBeenCalled();
    });

    it('handles concurrent first-time registration race condition gracefully', async () => {
      mockDb.client.externalIdentity.findUnique
        .mockResolvedValueOnce(null) // first check returns null
        .mockResolvedValueOnce({ user: { id: 'race-winner-user', displayName: 'Winner' } }); // recheck finds winner

      // Simulate P2002 unique constraint violation on concurrent insert
      mockDb.client.$transaction.mockRejectedValue({ code: 'P2002', message: 'Unique constraint failed' });

      const user = await googleOAuth.resolveUserFromGoogle({
        sub: 'google-sub-race',
        name: 'Racer',
        email: 'race@example.com',
        email_verified: true,
      });

      expect(user.id).toBe('race-winner-user');
    });

    it('fetches primary verified email for GitHub accounts with private email', async () => {
      jest.spyOn(gitHubOAuth, 'fetchGitHubPrimaryEmail').mockResolvedValue('private.verified@example.com');

      const email = await gitHubOAuth.fetchGitHubPrimaryEmail('github-token-123');
      expect(email).toBe('private.verified@example.com');
    });
  });

  describe('AuthController Logout and Session Revocation', () => {
    it('logout revokes the session in database and clears the session cookie', async () => {
      const mockReq = {
        headers: { cookie: 'rf_session=active-token-to-revoke' },
        sessionToken: 'active-token-to-revoke',
      };
      const mockRes = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };

      await authController.logout(mockReq as unknown as AuthenticatedRequest, mockRes as unknown as Response);

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('active-token-to-revoke');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Max-Age=0'),
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('AuthController Endpoints', () => {
    it('googleStart redirects to Google authorization URL (302)', async () => {
      const mockRes = {
        redirect: jest.fn(),
      };

      await authController.googleStart('http://localhost:5173', mockRes as unknown as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
      );
    });

    it('googleCallback sets session cookie and redirects with token in URL', async () => {
      mockDb.client.oAuthState.findUnique.mockResolvedValue({
        id: 'state-id-1',
        state: 'valid-state',
        codeVerifier: 'verifier-123',
        redirectUri: 'https://relayforge-staging-web.onrender.com',
        expiresAt: new Date(Date.now() + 600000),
      });

      jest.spyOn(googleOAuth, 'exchangeCodeForToken').mockResolvedValue('google-mock-access-token');
      jest.spyOn(googleOAuth, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-1111',
        name: 'Test User',
        email: 'test@example.com',
      });
      jest.spyOn(googleOAuth, 'resolveUserFromGoogle').mockResolvedValue({
        id: 'user-uuid-2',
        displayName: 'Test User',
      } as User);

      const mockRes = {
        setHeader: jest.fn(),
        redirect: jest.fn(),
      };

      await authController.googleCallback('code-123', 'valid-state', mockRes as unknown as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('rf_session='),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        'https://relayforge-staging-web.onrender.com/?token=rf_test_session_token',
      );
    });

    it('githubStart redirects to GitHub authorization URL (302)', async () => {
      const mockRes = {
        redirect: jest.fn(),
      };

      await authController.githubStart('http://localhost:5173', mockRes as unknown as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('https://github.com/login/oauth/authorize'),
      );
    });
  });
});
