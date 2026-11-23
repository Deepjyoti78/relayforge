import type { User } from '../../generated/prisma/client';

/** UI routing metadata, never an authorization decision or persisted credential. */
export interface OAuthUserResolution {
  user: User;
  isNewUser: boolean;
}
