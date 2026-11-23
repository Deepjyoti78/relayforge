// TEST-ONLY launcher. Never imported by src or shipped as an API entry point.
if (process.env.NODE_ENV !== 'test') throw new Error('Browser auth fixtures require NODE_ENV=test');
require('../load-integration-env.cjs'); // Refuses databases not ending in _test.
require('ts-node/register');
const { createServer } = require('node:http');
const { Readable } = require('node:stream');
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
  let run = randomUUID();
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
  let githubId = randomInt(1, 2000000000);
  github.fetchGitHubProfile = async () => ({ id: githubId, login: 'browser-' + run, name: 'Browser GitHub User', email: null });
  github.fetchGitHubPrimaryEmail = async () => 'browser-github-' + run + '@example.test';
  const attacker = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost:3311');
      if (req.method === 'POST' && url.pathname === '/__test/identity' && req.headers['x-test-control'] === 'rotate') {
        run = randomUUID(); githubId = randomInt(1, 2000000000);
        res.writeHead(204); return res.end();
      }
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
  // Execute the production Worker handler in a local Node HTTP adapter. Only
  // the configured HTTPS upstream transport is mapped to the loopback API.
  // This tests the real proxy/cookie/redirect/SSE contract, not Cloudflare TLS.
  const { proxyRequest } = await import('../../web/worker.js');
  const frontend = process.env.FRONTEND_URL;
  const gateway = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      const request = new Request(new URL(req.url, frontend), {
        method:req.method, headers:req.headers, signal:controller.signal,
        ...(!['GET','HEAD'].includes(req.method) ? {body:Readable.toWeb(req), duplex:'half'} : {}),
      });
      const response = await proxyRequest(request, {API_ORIGIN:'https://api.proxy.test', FRONTEND_URL:frontend,
        ASSETS:{fetch:async()=>new Response('Not an asset server',{status:404})}}, (outbound, options) => {
          const upstream = new URL(outbound.url);
          if (upstream.origin !== 'https://api.proxy.test') throw new Error('Unexpected upstream');
          upstream.protocol='http:'; upstream.hostname='127.0.0.1'; upstream.port='3310';
          return fetch(new Request(upstream, outbound), options);
        });
      const headers = Object.fromEntries([...response.headers].filter(([key])=>key !== 'set-cookie'));
      const cookies = response.headers.getSetCookie();
      if (cookies.length) headers['set-cookie']=cookies;
      res.writeHead(response.status, headers);
      if (response.body) Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
      else res.end();
    } catch { if (!res.headersSent) res.writeHead(503); res.end(); }
  });
  await new Promise(resolve => attacker.listen(3311, '127.0.0.1', resolve));
  await new Promise(resolve => gateway.listen(3312, '127.0.0.1', resolve));
  await app.listen(3310, '127.0.0.1');
  const close = async () => {
    for (const server of [attacker, gateway]) { server.close(); server.closeAllConnections(); }
    await app.close();
  };
  process.on('SIGTERM', close); process.on('SIGINT', close);
})().catch(error => { console.error(error); process.exit(1); });
