import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomInt, randomUUID } from 'node:crypto';
import { createApiApplication } from '../src/api/create-api';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { GitHubOAuthService } from '../src/modules/auth/github-oauth.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';

describe('OAuth provisioning with restricted PostgreSQL RLS', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await createApiApplication(); });
  afterAll(async () => { await app?.close(); });
  it.each(['google', 'github'] as const)('%s provisions an initial owner workspace and reuses verified identities', async (provider) => {
    const id = randomUUID();
    const email = 'oauth-' + id + '@example.test';
    const service = app.get(GoogleOAuthService);
    const { user, isNewUser } = provider === 'google'
      ? await service.resolveUserFromGoogle({ sub: id, name: 'RLS OAuth User', email, email_verified: true })
      : await app.get(GitHubOAuthService).resolveUserFromGitHub({ id: Date.now(), login: 'rls-' + id, name: 'RLS OAuth User' }, email);
    expect(isNewUser).toBe(true);
    const memberships = await app.get(TenantContextService).runInUserContext(user.id, tx => tx.membership.findMany({ where: { userId: user.id } }));
    expect(memberships).toHaveLength(1); expect(memberships[0]?.role).toBe('OWNER');
    // A verified Google identity for the same email links to this user without another workspace.
    const linked = await service.resolveUserFromGoogle({ sub: 'linked-' + id, email, email_verified: true });
    expect(linked.user.id).toBe(user.id); expect(linked.isNewUser).toBe(false);
    const again = await service.resolveUserFromGoogle({ sub: 'linked-' + id, email, email_verified: true });
    expect(again.user.id).toBe(user.id); expect(again.isNewUser).toBe(false);
    const githubLinked = await app.get(GitHubOAuthService).resolveUserFromGitHub({ id: randomInt(1, 2147483647), login: 'linked-' + id }, email);
    expect(githubLinked.user.id).toBe(user.id); expect(githubLinked.isNewUser).toBe(false);
  });
});
