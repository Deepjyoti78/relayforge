// TEST-ONLY launcher. Never imported by src or shipped as an API entry point.
if (process.env.NODE_ENV !== 'test') throw new Error('Browser auth fixtures require NODE_ENV=test');
require('../load-integration-env.cjs'); // Refuses databases not ending in _test.
require('ts-node/register');
const { createServer } = require('node:http');
const { randomUUID, randomInt } = require('node:crypto');
const { createApiApplication } = require('../../src/api/create-api');
const { GoogleOAuthService } = require('../../src/modules/auth/google-oauth.service');
const { GitHubOAuthService } = require('../../src/modules/auth/github-oauth.service');
const { SessionService } = require('../../src/modules/auth/session.service');
const { TenantContextService } = require('../../src/modules/database/tenant-context.service');
const { DatabaseService } = require('../../src/modules/database/database.service');
const { parseCookies } = require('../../src/common/cookies');
const { hashToken } = require('../../src/common/crypto');

(async () => {
  const app = await createApiApplication();
  const run = randomUUID();
  // Only external provider HTTP calls are mocked. PKCE/state persistence,
  // provisioning, account linking, session hashing, guards and RLS are real.
  const exchange = async (code, verifier) => {
    if (code !== 'browser-mock-code' || typeof verifier !== 'string' || verifier.length < 43) throw new Error('Invalid mocked exchange');
    return 'mock-provider-access-token';
  };
  const google = app.get(GoogleOAuthService);
  google.exchangeCodeForToken = exchange;
  google.fetchGoogleProfile = async () => ({ sub: 'browser-google-' + run, name: 'Browser Google User',
    email: 'browser-google-' + run + '@example.test', email_verified: true });
  const github = app.get(GitHubOAuthService);
  github.exchangeCodeForToken = exchange;
  const githubId = randomInt(1, 2000000000);
  github.fetchGitHubProfile = async () => ({ id: githubId, login: 'browser-' + run, name: 'Browser GitHub User', email: null });
  github.fetchGitHubPrimaryEmail = async () => 'browser-github-' + run + '@example.test';
  const attacker = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost:3311');
      if (req.method === 'GET' && url.pathname.startsWith('/mock-provider/')) {
        const callback = new URL(url.searchParams.get('redirect_uri'));
        callback.searchParams.set('state', url.searchParams.get('state'));
        callback.searchParams.set('code', 'browser-mock-code');
        res.writeHead(302, { Location: callback.toString() }); return res.end();
      }
      if (req.method === 'POST' && url.pathname.startsWith('/__test/session/')) {
        const token = parseCookies(req.headers.cookie).rf_session;
        const auth = token && await app.get(SessionService).validateSession(token);
        if (!auth) { res.writeHead(401); return res.end(); }
        if (url.pathname.endsWith('/revoke')) await app.get(SessionService).revokeSession(token);
        else if (url.pathname.endsWith('/expire')) await app.get(DatabaseService).client.session.update({
          where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) },
        });
        else if (url.pathname.endsWith('/remove-membership')) {
          const orgId = req.headers['x-test-org'];
          if (typeof orgId !== 'string') { res.writeHead(400); return res.end(); }
          await app.get(TenantContextService).runInTenantContext(orgId, auth.user.id, tx => tx.membership.deleteMany({
            where: { organizationId: orgId, userId: auth.user.id },
          }));
        }
        else { res.writeHead(400); return res.end(); }
        res.writeHead(204); return res.end();
      }
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Untrusted origin fixture</title>');
    } catch { res.writeHead(500); res.end(); }
  });
  for (const [provider, service] of [['google', google], ['github', github]]) {
    const createAuthorizationUrl = service.createAuthorizationUrl.bind(service);
    service.createAuthorizationUrl = async redirect => {
      const original = await createAuthorizationUrl(redirect);
      const url = new URL(original.url);
      return { state: original.state, url: 'http://localhost:3311/mock-provider/' + provider + url.search };
    };
  }
  await new Promise(resolve => attacker.listen(3311, '127.0.0.1', resolve));
  await app.listen(3310, '127.0.0.1');
  const close = async () => { attacker.close(); await app.close(); process.exit(0); };
  process.on('SIGTERM', close); process.on('SIGINT', close);
})().catch(error => { console.error(error); process.exit(1); });
