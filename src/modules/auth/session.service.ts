import { Injectable } from '@nestjs/common';
import { generateToken, hashToken } from '../../common/crypto';
import type { Session, User } from '../../generated/prisma/client';
import { DatabaseService } from '../database/database.service';

export interface AuthenticatedUserSession {
  session: Session;
  user: User;
}

@Injectable()
export class SessionService {
  // Session duration: 7 days
  private readonly sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

  constructor(private readonly database: DatabaseService) {}

  /**
   * Creates a new application session for a user.
   * Stores the SHA-256 hash of the generated session token in the database,
   * and returns the plaintext token to be set in the HttpOnly cookie.
   */
  async createSession(userId: string): Promise<{ token: string; session: Session }> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);

    const session = await this.database.client.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, session };
  }

  /**
   * Validates a session token.
   * Hashes the incoming token and checks for an active, unexpired, unrevoked session.
   */
  async validateSession(rawToken: string): Promise<AuthenticatedUserSession | null> {
    if (!rawToken || rawToken.length < 32) return null;

    const tokenHash = hashToken(rawToken);
    const session = await this.database.client.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration and revocation
    if (session.revokedAt !== null || session.expiresAt <= new Date()) {
      return null;
    }

    // Touch lastActiveAt if older than 60 seconds
    const now = new Date();
    if (now.getTime() - session.lastActiveAt.getTime() > 60_000) {
      await this.database.client.session.update({
        where: { id: session.id },
        data: { lastActiveAt: now },
      }).catch(() => undefined);
    }

    return { session, user: session.user };
  }

  /**
   * Revokes an active session by token.
   */
  async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await this.database.client.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes all sessions for a specific user (e.g. security reset).
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.database.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
