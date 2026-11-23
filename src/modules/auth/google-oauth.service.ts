import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { isTrustedFrontendUrl } from './browser-security';
import { generatePkcePair, generateState } from '../../common/crypto';
import type { OAuthUserResolution } from './oauth-user';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

export interface GoogleUserProfile {
  sub: string;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  email?: string | null;
  email_verified?: boolean;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly config: RuntimeConfig,
    private readonly database: DatabaseService,
  ) {}

  /**
   * Generates a Google OAuth 2.0 authorization URL with PKCE (S256) and a unique short-lived state.
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
      client_id: this.config.values.googleClientId,
      redirect_uri: this.config.values.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  /**
   * Handles the Google OAuth callback.
   * Atomically consumes the state record, exchanges the code and PKCE verifier for an access token,
   * fetches the Google user profile, and resolves or registers the User.
   */
  async handleCallback(code: string, state: string): Promise<OAuthUserResolution & { redirectUri: string }> {
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

    // Exchange authorization code for Google access token
    const accessToken = await this.exchangeCodeForToken(code, storedState.codeVerifier);

    // Fetch Google user profile
    const profile = await this.fetchGoogleProfile(accessToken);

    // Resolve or create user anchored on Google's stable numeric subject ID (sub)
    const { user, isNewUser } = await this.resolveUserFromGoogle(profile);

    return {
      user,
      isNewUser,
      redirectUri: storedState.redirectUri && isTrustedFrontendUrl(storedState.redirectUri, this.config.values.frontendUrl)
        ? storedState.redirectUri : this.config.values.frontendUrl,
    };
  }

  /**
   * Exchanges authorization code and PKCE code_verifier for an OAuth access token at Google.
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.values.googleClientId,
        client_secret: this.config.values.googleClientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.config.values.googleCallbackUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      this.logger.error({ event: 'google_token_exchange_failed', status: response.status });
      throw new BadRequestException('Failed to exchange authorization code with Google');
    }

    const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!data.access_token) {
      this.logger.warn({ event: 'google_token_error', error: data.error });
      throw new BadRequestException(data.error_description ?? 'Google token exchange returned an error');
    }

    return data.access_token;
  }

  /**
   * Fetches the user profile from Google using the ephemeral access token.
   */
  async fetchGoogleProfile(accessToken: string): Promise<GoogleUserProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch user profile from Google');
    }

    return (await response.json()) as GoogleUserProfile;
  }

  /**
   * Resolves or registers a User anchored to Google's stable provider user ID (`sub`).
   * If the identity exists, updates profile details. If new, provisions a new User,
   * ExternalIdentity, and initial personal organization with OWNER membership.
   */
  async resolveUserFromGoogle(profile: GoogleUserProfile): Promise<OAuthUserResolution> {
    const providerUserId = profile.sub;

    // Search for existing external identity
    const existingIdentity = await this.database.client.externalIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
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
          displayName: profile.name ?? existingIdentity.user.displayName,
          avatarUrl: profile.picture ?? existingIdentity.user.avatarUrl,
          email: profile.email ?? existingIdentity.user.email,
        },
      });

      return { user: updatedUser, isNewUser: false };
    }

    // Safe account linking: Only link to an existing user if Google verified the email
    const isEmailVerified = profile.email_verified === true && Boolean(profile.email);
    if (isEmailVerified && profile.email) {
      const existingUserByEmail = await this.database.client.user.findFirst({
        where: { email: profile.email },
      });

      if (existingUserByEmail) {
        try {
          await this.database.client.externalIdentity.create({
            data: {
              userId: existingUserByEmail.id,
              provider: 'google',
              providerUserId,
              providerUsername: profile.email ?? profile.name ?? null,
            },
          });

          // Refresh avatar/displayName if missing on existing account
          const linkedUser = await this.database.client.user.update({
            where: { id: existingUserByEmail.id },
            data: {
              avatarUrl: existingUserByEmail.avatarUrl ?? profile.picture ?? null,
              displayName: existingUserByEmail.displayName ?? profile.name ?? null,
            },
          });
          return { user: linkedUser, isNewUser: false };
        } catch (err: unknown) {
          // If concurrent request created the identity first, return existing user
          if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
            const recheck = await this.database.client.externalIdentity.findUnique({
              where: {
                provider_providerUserId: {
                  provider: 'google',
                  providerUserId,
                },
              },
              include: { user: true },
            });
            if (recheck?.user) return { user: recheck.user, isNewUser: false };
          }
          throw err;
        }
      }
    }

    // New user registration with automatic workspace provisioning
    try {
      const registeredUser = await this.database.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            displayName: profile.name ?? profile.email?.split('@')[0] ?? 'Google User',
            avatarUrl: profile.picture ?? null,
            email: profile.email ?? null,
          },
        });

        // Set PostgreSQL session variable so Row-Level Security allows organization & membership creation
        await tx.$executeRaw`
          SELECT set_config('app.current_user_id', ${user.id}, true),
                 set_config('app.current_org_id', '', true)
        `;

        await tx.externalIdentity.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerUserId,
            providerUsername: profile.email ?? profile.name ?? null,
          },
        });

        // Auto-provision initial workspace
        const orgName = `${user.displayName || 'Personal'}'s Workspace`;
        const baseSlug = (user.displayName || 'workspace')
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
      return { user: registeredUser, isNewUser: true };
    } catch (err: unknown) {
      // Handle concurrent first-time registration race condition
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        const recheck = await this.database.client.externalIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'google',
              providerUserId,
            },
          },
          include: { user: true },
        });
        if (recheck?.user) return { user: recheck.user, isNewUser: false };
      }
      throw err;
    }
  }
}
