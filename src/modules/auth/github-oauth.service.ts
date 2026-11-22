import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { isTrustedFrontendUrl } from './browser-security';
import { generatePkcePair, generateState } from '../../common/crypto';
import type { User } from '../../generated/prisma/client';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

export interface GitHubUserProfile {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

@Injectable()
export class GitHubOAuthService {
  private readonly logger = new Logger(GitHubOAuthService.name);

  constructor(
    private readonly config: RuntimeConfig,
    private readonly database: DatabaseService,
  ) {}

  /**
   * Generates a GitHub OAuth authorization URL with PKCE (S256) and a unique short-lived state.
   * Persists state, PKCE code verifier, and redirect URI in PostgreSQL.
   */
  async createAuthorizationUrl(redirectUri?: string): Promise<{ url: string; state: string }> {
    const state = generateState();
    const { verifier, challenge } = generatePkcePair();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

    const resolvedRedirectUri = redirectUri && isTrustedFrontendUrl(redirectUri, this.config.values.frontendUrl)
      ? redirectUri
      : this.config.values.frontendUrl;

    await this.database.client.oAuthState.create({
      data: {
        state,
        codeVerifier: verifier,
        redirectUri: resolvedRedirectUri,
        expiresAt,
      },
    });

    const params = new URLSearchParams({
      client_id: this.config.values.githubClientId,
      redirect_uri: this.config.values.githubCallbackUrl,
      scope: 'read:user user:email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Handles the OAuth callback.
   * Atomically consumes the state record, exchanges the code and PKCE verifier for an access token,
   * fetches the GitHub profile, and resolves or registers the User.
   */
  async handleCallback(code: string, state: string): Promise<{ user: User; redirectUri: string }> {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    // Atomically find and consume OAuth state to prevent reuse
    const storedState = await this.database.client.oAuthState.findUnique({
      where: { state },
    });

    if (!storedState || storedState.expiresAt <= new Date()) {
      if (storedState) {
        await this.database.client.oAuthState.delete({ where: { id: storedState.id } }).catch(() => undefined);
      }
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    // Delete state immediately so it cannot be replayed
    await this.database.client.oAuthState.delete({ where: { id: storedState.id } });

    // Exchange authorization code for GitHub access token
    const accessToken = await this.exchangeCodeForToken(code, storedState.codeVerifier);

    // Fetch GitHub user profile and verified email
    const profile = await this.fetchGitHubProfile(accessToken);
    const email = profile.email ?? (await this.fetchGitHubPrimaryEmail(accessToken));

    // Resolve or create user anchored on stable GitHub numeric user ID (converted to string)
    const user = await this.resolveUserFromGitHub(profile, email);

    return {
      user,
      redirectUri: storedState.redirectUri && isTrustedFrontendUrl(storedState.redirectUri, this.config.values.frontendUrl)
        ? storedState.redirectUri : this.config.values.frontendUrl,
    };
  }

  /**
   * Exchanges authorization code and PKCE code_verifier for an OAuth access token at GitHub.
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.values.githubClientId,
        client_secret: this.config.values.githubClientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.values.githubCallbackUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      this.logger.error({ event: 'github_token_exchange_failed', status: response.status });
      throw new BadRequestException('Failed to exchange authorization code with GitHub');
    }

    const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!data.access_token) {
      this.logger.warn({ event: 'github_token_error', error: data.error });
      throw new BadRequestException(data.error_description ?? 'GitHub token exchange returned an error');
    }

    return data.access_token;
  }

  /**
   * Fetches the user profile from GitHub using the ephemeral access token.
   */
  async fetchGitHubProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RelayForge-Auth',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch user profile from GitHub');
    }

    return (await response.json()) as GitHubUserProfile;
  }

  /**
   * Fetches verified primary email from GitHub if not public on the profile.
   */
  async fetchGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RelayForge-Auth',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;
      const emails = (await response.json()) as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      return primary?.email ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves or registers a User anchored to GitHub's stable provider user ID.
   * If the identity exists, updates profile details. If new, provisions a new User and ExternalIdentity.
   */
  async resolveUserFromGitHub(profile: GitHubUserProfile, email: string | null): Promise<User> {
    const providerUserId = profile.id.toString();

    // Search for existing external identity
    const existingIdentity = await this.database.client.externalIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'github',
          providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      // Update mutable profile info if changed
      const updatedUser = await this.database.client.user.update({
        where: { id: existingIdentity.userId },
        data: {
          displayName: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url ?? null,
          email: email ?? existingIdentity.user.email,
        },
      });

      if (existingIdentity.providerUsername !== profile.login) {
        await this.database.client.externalIdentity.update({
          where: { id: existingIdentity.id },
          data: { providerUsername: profile.login },
        });
      }

      return updatedUser;
    }

    // Safe account linking: If verified email matches an existing user, link to that account
    if (email) {
      const existingUserByEmail = await this.database.client.user.findFirst({
        where: { email },
      });

      if (existingUserByEmail) {
        try {
          await this.database.client.externalIdentity.create({
            data: {
              userId: existingUserByEmail.id,
              provider: 'github',
              providerUserId,
              providerUsername: profile.login,
            },
          });

          return await this.database.client.user.update({
            where: { id: existingUserByEmail.id },
            data: {
              avatarUrl: existingUserByEmail.avatarUrl ?? profile.avatar_url ?? null,
              displayName: existingUserByEmail.displayName ?? profile.name ?? profile.login,
            },
          });
        } catch (err: unknown) {
          // If concurrent request created the identity first, return existing user
          if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
            const recheck = await this.database.client.externalIdentity.findUnique({
              where: {
                provider_providerUserId: {
                  provider: 'github',
                  providerUserId,
                },
              },
              include: { user: true },
            });
            if (recheck?.user) return recheck.user;
          }
          throw err;
        }
      }
    }

    // New user registration with automatic workspace provisioning
    try {
      return await this.database.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            displayName: profile.name ?? profile.login,
            avatarUrl: profile.avatar_url ?? null,
            email,
          },
        });

        await tx.externalIdentity.create({
          data: {
            userId: user.id,
            provider: 'github',
            providerUserId,
            providerUsername: profile.login,
          },
        });

        // Bootstrap under the new user's transaction-local RLS identity.
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true), set_config('app.current_org_id', '', true)`;

        // Auto-provision initial workspace
        const orgName = `${user.displayName || profile.login || 'Personal'}'s Workspace`;
        const baseSlug = (profile.login || user.displayName || 'workspace')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 32);
        const suffix = Math.random().toString(36).substring(2, 7);
        const slug = `${baseSlug || 'org'}-${suffix}`;

        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug,
            createdBy: user.id,
          },
        });

        await tx.membership.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: 'OWNER',
          },
        });

        return user;
      });
    } catch (err: unknown) {
      // Handle concurrent first-time registration race condition
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        const recheck = await this.database.client.externalIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'github',
              providerUserId,
            },
          },
          include: { user: true },
        });
        if (recheck?.user) return recheck.user;
      }
      throw err;
    }
  }
}
