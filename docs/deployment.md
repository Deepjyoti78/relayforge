# Deployment configuration and authentication acceptance

This is a source/configuration guide, not evidence of a live deployment. Consult the
[release checklist](auth-release-checklist.txt) before approving a release and the
[security review](auth-security-review.txt) for separately recorded local and CI results.
No deployment or live-secret changes were performed by this review.

## What the repository actually declares

- [render.yaml](../render.yaml) declares three services: API and worker as Node
  `type: web` services, plus a static frontend. The worker exposes /health. It does
  not declare a dedicated `type: worker`, managed PostgreSQL/Redis, or a private VPC.
- PostgreSQL and Redis are supplied through environment variables. Comments mention
  external Supabase/Upstash services; live accounts, regions, plans and network
  isolation have not been verified here. No current pricing claim is made.
- Both [Wrangler configurations](../wrangler.jsonc) ([web](../web/wrangler.jsonc))
  serve static SPA assets only. They contain no API proxy handler or run_worker_first.
- API starts with `npm run start:api`, worker with `npm run start:worker`. API probes
  are /health/live and /health/ready; the latter checks PostgreSQL. Redis connectivity
  and noeviction checks are currently advisory. PostgreSQL 17 and Redis 7.4 are used
  by the isolated integration containers; this is not a live-version assertion.

## Browser-cookie topology is a release decision

The blueprint's frontend and API use different onrender.com hostnames. The
[Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat) includes
onrender.com, workers.dev and pages.dev. The two Render hosts are therefore different
sites; a Cloudflare-default frontend to the Render API is cross-site too.

Top-level OAuth callback navigation can set an API cookie, yet subsequent frontend
fetch/EventSource requests to that API are third-party contexts. SameSite=None;
Secure plus credentials can work only where browser policy permits them. Lax omits
cookies on cross-site fetches, and CORS cannot override third-party-cookie blocking.
Do not share Domain=onrender.com or restore URL/localStorage token delivery.
See [MDN's cookie guidance](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

Choose one reviewed topology:

| Topology | Public frontend/API | Required configuration |
| --- | --- | --- |
| Same-site custom domains | HTTPS app.relayforge.example and api.relayforge.example, replaced with owned names | FRONTEND_URL=frontend; VITE_API_URL=API; host-only API cookie; SESSION_COOKIE_SAME_SITE=lax; exact CORS |
| Same-origin proxy | Frontend origin F serves SPA and proxies auth/API paths to Render | VITE_API_URL=/; FRONTEND_URL=F; both provider callbacks through F; SESSION_COOKIE_SAME_SITE=lax |

For the proxy proposal, route /auth/*, /v1/* and /health/* before SPA fallback using a
reviewed Worker handler, fixed API_ORIGIN, ASSETS binding and assets.run_worker_first.
Preserve method/body/query, browser Origin/Referer, Cookie, individual Set-Cookie
headers, status, Location and streaming response bodies. Use upstream redirect:
manual, no auth caching/buffering, and no browser-selected upstream. This production
proxy is not implemented or deployed by this PR; Playwright exercises a local Vite proxy.

## Configuration and provider registration

API runtime names: NODE_ENV, FRONTEND_URL, SESSION_COOKIE_NAME,
SESSION_COOKIE_SAME_SITE, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, DATABASE_URL, REDIS_URL,
ENCRYPTION_KEY, HOST and PORT. Worker and migration identities use WORKER_DATABASE_URL
and MIGRATION_DATABASE_URL separately. VITE_API_URL is a frontend BUILD variable;
never put provider/database secrets in VITE_*.

The [release checklist](auth-release-checklist.txt) gives exact public callback URLs,
provider settings and the custom-domain/proxy variable matrix. Google authorized
redirect URIs must match GOOGLE_CALLBACK_URL. GitHub's callback must match
GITHUB_CALLBACK_URL, with wildcard matching disabled. Both must belong to the same
provider app/environment as the configured client ID/secret. Live consent tests are
still required for Google and GitHub; mocked provider tests are not a substitute.

Omitted SESSION_COOKIE_SAME_SITE preserves production None for compatibility; explicit
none requires NODE_ENV=production/Secure. Prefer lax only after choosing a same-site
or same-origin layout. Local defaults consistently use localhost for frontend and
callbacks; existing .env files must be checked rather than assumed to have changed.

## Existing infrastructure security gaps

The blueprint currently copies API DATABASE_URL into worker WORKER_DATABASE_URL.
It also runs role initialization/migrations during API build and does not declare a
separate migration URL. Provision distinct restricted API/worker roles and a separate
migration identity through the approved process before release. The initialization
script can swallow role/connection errors and exits successfully; it does not prove
credentials, grants or RLS are correct. Runtime startup warns about unsafe roles
rather than failing closed. A successful health probe does not validate role isolation.

Current PostgreSQL cloud/pooler and Redis TLS code disables certificate verification.
This is an existing transport-security gap, not fixed here. Verify certificates and
connections in a separate focused change. Do not treat an encrypted URL as proof of
server authentication. No secret rotation or live provisioning was attempted.

## Validation and deployment gates

Local: npm test, npm run test:integration, npm run test:browser, npm run lint,
npm run typecheck, npm --prefix web run build, npm run build, git diff --check.
Integration/browser tests use a dedicated _test database and local Redis; browser
consent/provider HTTP is mocked while cookies, callbacks, sessions and RLS are real.

Hosted CI: the verify job audits dependencies before later gates. Merged PR #2
supplies the scoped Effect 3.22.1 override; the refreshed production audit passes.
Keep the audit gate enabled and verify it on every release head. The independent
browser-authentication job provides browser coverage separately. Record the actual
head SHA, run URL, conclusion and skipped checks; never label local results as CI.
This PR retains that merged fix without another dependency upgrade or audit exception.

The legacy staging-e2e-verify.cjs harness checks health, one invalid bearer token and
an OAuth-start redirect/state. It does not validate successful bearer rejection,
callback destination, PKCE exchange, live consent, ingestion or RLS isolation. Its
historical PASSED text is not deployment acceptance. This review did not run it live.

Live health, migration status, runtime identities, provider consent and browser policy
are pending authorized acceptance. Earlier unversioned tables claiming live services,
12 applied migrations or complete cookie-only auth have been removed. Follow the
release checklist and review the draft PR; do not auto-merge or deploy from this guide.
