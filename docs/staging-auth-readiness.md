# Staging authentication readiness

Prepared 23 November 2026 from staging `93c3840`: authentication PR #1 and dependency PR #2 are merged. This branch prepares code and configuration; it does not deploy, change provider registrations or live settings, or run live migrations. Delivery PR #3 is excluded.

## Current deployment evidence and limits

The operator confirmed these current URLs:

- Render frontend: `https://relayforge-staging-web.onrender.com`
- Render API: `https://relayforge-staging-api.onrender.com`
- A final Cloudflare frontend/custom domain has **not** been configured. The Render frontend is **not** assumed to host the new Worker.

Public HTTP probes returned 200 for the frontend and API `/health/live`. Normal OAuth-start requests returned the following without following provider login. These requests create only ordinary short-lived OAuth state; no provider login, account or session was created. State/cookie values were not recorded.

| Observed API start | Advertised callback | PKCE/state | Binding cookie / Cache-Control |
| --- | --- | --- | --- |
| Google, 302 | `https://relayforge-staging-api.onrender.com/auth/google/callback` | S256 / present | No Set-Cookie / absent |
| GitHub, 302 | `https://relayforge-staging-api.onrender.com/auth/github/callback` | S256 / present | No Set-Cookie / absent |

Both responses had `Referrer-Policy: no-referrer`. They do **not** match merged PR #1's expected browser-binding cookie/no-store start contract. A deployed SHA is unavailable, so no deployed-commit claim is made. Verify the approved API rollout serves the merged security code before accepting any cutover. Health 200 alone does not prove authentication readiness.

These are **advertised runtime callbacks**, not independently verified registrations in the Google/GitHub consoles. Console access and actual consent/token exchange were not exercised. Do not infer that a callback is registered because the API sends it.

Negative callbacks with a deliberately nonexistent state and invalid code returned 302 to the current Render frontend `/` with an error parameter, no token parameter and no Set-Cookie, for both providers. This is rejection/fallback evidence consistent with that frontend setting, not a successful sign-in or console-registration test. A fresh credential-free frontend browser visit did not produce a completed `/v1/me` response during observation; the actual deployed `VITE_API_URL` value was not independently recovered from hosting settings.

Stateless preflights to live `/v1/me` returned 204 with credentials enabled and echoed both the real Render frontend and an unrelated synthetic `https://untrusted-review.onrender.com` origin. That is inconsistent with merged PR #1's strict origin policy and is an additional **live release blocker**. No cookie, authorization credential or authenticated response was used in these probes. Do not treat a same-origin gateway as a substitute for rolling out the API's strict CORS/CSRF/state implementation.

The current Render hosts are different sites under the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat). A browser request from that frontend to that API is a third-party cookie context. `SameSite=None; Secure` and credentialed CORS cannot override cookie blocking; `Lax` cannot fix a direct cross-site fetch. Sharing `Domain=onrender.com` is not a solution. See [browser cookie policy](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

## Implemented topology and behavior

Use one finalized HTTPS **Cloudflare** frontend origin **F**, with Render API origin **A** as a server-side upstream:

```text
Browser → F/assets and F/dashboard/* → Cloudflare assets/SPA
Browser → F/auth/*, F/v1/*, F/health/* → Worker → fixed HTTPS A
Provider → F/auth/google/callback or F/auth/github/callback → Worker → A
```

The browser's state/session cookies are host-only cookies on **F**. The browser does not need a cookie for **A**. OAuth's external provider navigation remains a normal top-level authorization-code flow.

Both Wrangler entry points now use `web/worker.js`, `ASSETS`, and reserved routes before SPA fallback. The gateway:

- Requires explicit `FRONTEND_URL=F` and `API_ORIGIN=A`; no Render frontend or Cloudflare hostname is guessed. Missing/invalid configuration returns 503; an unconfigured preview frontend gets 421 for API routes.
- Allows only a fixed HTTPS upstream origin without credentials/path/query/fragment; rejects loops. A query/path/header cannot select another upstream. Loopback HTTP frontend origins are supported only for local tests/development, not as working public Worker origins.
- Preserves method/body/query, original browser Origin/Referer, Cookie/Authorization, individual Set-Cookie headers, response status and Location. It strips forwarded/hop-by-hop headers, uses manual redirects and no-store fetches/responses, and streams bodies/SSE without buffering or application retries.
- Does not rewrite cookie Domain or broaden CORS/CSRF. Existing API checks must accept exactly F. The state/session cookies must remain host-only, HttpOnly, Secure and appropriately scoped.
- Fails closed on legacy OAuth redirects containing session/token query or fragment parameters, without forwarding Location or Set-Cookie. It never follows a provider redirect server-side with cookies/Authorization.

The frontend defaults to its own origin outside local development; set `VITE_API_URL=/` explicitly for this topology. An explicit cross-origin build setting remains supported for a separately reviewed same-site custom-domain topology. The existing Render blueprint is unchanged and still sets its direct API URL.

Only a confirmed `/v1/me` **401** means signed out. 502/503, network failures and invalid responses leave authentication unknown: show a retryable error, retain route/metadata, and never authorize an initial render from cached identity. Retry rechecks the session; it does not replay mutations. Previously verified in-memory content may remain during a background outage, with an error notice; API authorization remains authoritative.

Dashboard tab/organization intent is encoded as `/dashboard/<tab>?org=<id>` (`/dashboard` for the overview). Requested organizations must occur in validated memberships. Reload retains the selected route. The login modal stays on the landing page until OAuth begins.

OAuth resolution now explicitly reports whether its transaction created the account. Only that case redirects to `/onboarding`; existing identities, verified account links and concurrent-registration recovery go to the dashboard, preserving a trusted dashboard return route. This is UI routing metadata, not a credential or authorization decision. The existing default owner workspace/RLS setup is unchanged. Onboarding remains optional; refresh retains `/onboarding`, while Skip/complete goes to the dashboard. Server-side onboarding completion is not introduced; a returning account is not forced through setup merely because a fresh browser lacks local preferences. No database migration is needed.

Dashboard redirects remove legacy credential/OAuth parameters and landing-preview flags. Session credentials are never transported through URLs, postMessage, BroadcastChannel or localStorage. Noncredential user/org/workload caches remain; they do not establish authentication.

## Exact configuration matrix once F is finalized

Use F as a canonical HTTPS origin, without a path/query/fragment. A is currently the Render API above, but remains configurable.

| Component | Variable/binding | Required value |
| --- | --- | --- |
| Cloudflare Worker runtime | `FRONTEND_URL` | F, **not** the existing Render frontend URL |
| Cloudflare Worker runtime | `API_ORIGIN` | A, HTTPS origin only |
| Cloudflare assets | `ASSETS` | Wired by both Wrangler configurations |
| Frontend **build** | `VITE_API_URL` | `/` (requires rebuild) |
| Render API runtime | `NODE_ENV` | `production` |
| Render API runtime | `FRONTEND_URL` | F |
| Render API runtime | `GOOGLE_CALLBACK_URL` | `F/auth/google/callback` |
| Render API runtime | `GITHUB_CALLBACK_URL` | `F/auth/github/callback` |
| Render API runtime | `SESSION_COOKIE_SAME_SITE` | `lax` explicitly |
| Render API runtime | `SESSION_COOKIE_NAME` | Keep the existing stable name; do not silently rename/rotate sessions |
| Render API runtime | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Existing approved staging app, verified manually; never copy secrets into Worker/VITE/Git |
| Render API runtime | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Existing approved staging app, verified manually |

Keep `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `HOST`, `PORT`, and separate `WORKER_DATABASE_URL`/`MIGRATION_DATABASE_URL` identities unchanged through the approved operations process. No secret or migration connection belongs in the Worker or frontend. There is no new CORS wildcard, cookie-domain setting or token bridge.

Wrangler intentionally contains no guessed public origin/upstream values. Pass the two **nonsecret** Worker variables explicitly in the approved deployment command/configuration. Do not assume Render environment variables are available to Cloudflare or that frontend build variables update at runtime. Preview hosts must not be added with wildcard trust.

## Operator-only deployment and console steps — not performed here

1. Independently confirm Render Auto-Deploy Off, Blueprint Auto Sync disabled, no queued deployment or hook caller, and controlled Cloudflare production/preview build triggers before merge approval. Merging source is not release authorization.
2. Choose a stable F in the intended Cloudflare account, confirm domain authorization/DNS/TLS, and choose a dedicated staging Worker name. Do not overwrite an unrelated Worker named `relayforge`. An owned verified custom domain is preferable for final provider branding. A workers.dev trial origin still requires provider-console/policy acceptance; no final hostname is assumed here.
3. Inspect the intended staging OAuth app/client IDs in both consoles and compare their allowed callbacks with the matrix. Keep existing secrets. The observed Render callback URLs are not the new F callbacks and are not proof of console registration.
4. **Google Auth Platform/Cloud Console:** use a Web application client; register the exact `F/auth/google/callback` Authorized redirect URI (scheme/host/port/path, no extra trailing slash). Set F as an Authorized JavaScript origin if that setting is used (origin only; this implementation uses server-side code exchange). Verify authorized domains/branding/consent audience and staging test users. Ensure homepage/privacy/terms and domain verification satisfy the app's publishing status. [Google web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [domain policies](https://developers.google.com/identity/protocols/oauth2/policies).
5. **GitHub Developer settings → OAuth Apps:** select the intended staging app; Homepage URL is F, authorization callback is exactly `F/auth/github/callback`. Confirm the client ID matches the API setting. Do not rely on wildcard/platform-domain matching. Coordinate the old/new callback cutover or separately approve a dedicated staging app; do not silently change credentials. [GitHub registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).
6. In a separately approved release, roll out the merged API security/readiness code and the API public values in the matrix. Verify browser-binding cookies/no-store on starts and state verification on callbacks. **The current API build command runs role initialization/migrations.** Review/replace that with an approved compile-only auth rollout; do not invoke it blindly. This branch changes no schema and does not run or authorize live migrations. Verify dedicated runtime roles and existing cloud PostgreSQL/Redis certificate-verification gaps separately.
7. Build the frontend for same origin. Validate the Worker bundle without uploading. Only after code, DNS/TLS, public configuration and console changes are approved, publish the dedicated Worker and attach the approved F. Source commands below are instructions, not operations performed by this task.

Example PowerShell commands from the repository root; replace F and verify the account/Worker name before the **approved publish** step:

```powershell
$frontendOrigin = 'https://REPLACE_WITH_FINAL_CLOUDFLARE_FRONTEND'
$apiOrigin = 'https://relayforge-staging-api.onrender.com'
$workerName = 'relayforge-staging' # confirm dedicated staging ownership
$env:VITE_API_URL = '/'
$env:WRANGLER_SEND_METRICS = 'false'
npm ci --include=dev
npm --prefix web ci --include=dev
npm --prefix web run build

# Local bundle/config validation only; this is the mode used by this review/CI.
npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --dry-run --config wrangler.jsonc --outdir .cache/worker-bundle

# OPERATOR ONLY, AFTER SEPARATE RELEASE APPROVAL. Not run by this task:
npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --config wrangler.jsonc --name $workerName --var "FRONTEND_URL:$frontendOrigin" --var "API_ORIGIN:$apiOrigin"
```

Use the same public variables/account/name when configuring a reviewed Cloudflare build integration later. Neither CI nor this task publishes a Worker. The pinned CLI is an ephemeral build tool; project lockfiles/dependency versions are unchanged. [Asset routing/bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [manual redirects](https://developers.cloudflare.com/workers/runtime-apis/request/), [multiple cookies](https://developers.cloudflare.com/workers/runtime-apis/headers/).

## Manual acceptance after an approved staging rollout

- Confirm F DNS/TLS, A health/readiness, exact app/client mappings and deployed API/Worker versions. API health alone is insufficient; the current observed start responses remain a blocker until corrected.
- In Chrome, Firefox and Safari with third-party cookies blocked, open F and its login modal. Opening/closing it must leave the landing URL unchanged. Use only controlled staging test accounts.
- Start Google/GitHub separately. In browser network tools verify provider `redirect_uri` is the exact **F** callback, PKCE S256/state are present, and the binding cookie is HttpOnly, Secure, SameSite=Lax, host-only, Path=/ and short-lived. Do not paste cookie/code/state values into logs/reports.
- Complete real provider consent. Callback must arrive through F, clear the provider binding, and set the stable session cookie with HttpOnly/Secure/Lax/Path=/ and expiry. Denial, stolen/missing/expired/replayed state must fail closed. No URL/postMessage/storage session token is acceptable.
- A new account goes to `/onboarding`; refresh retains setup, and Skip/complete goes to its dashboard. An existing account in a fresh browser goes to the dashboard without forced onboarding. Verify returning identities and approved verified-email linking.
- Verify F `/v1/me` returns 200/no-store using the cookie, navigation and dashboard hard refresh retain the user/tab/org, and frontend browser API requests stay on F. Cached identity alone must never unlock protected content.
- Use browser-local request blocking/response simulation, not a live service outage, to check 502/503/network lookup failures: explicit unknown/retry state, no apparent logout, no credential/cache destruction, and recovery to the same dashboard route. Confirm an actual 401 clears stale identity and denies protected UI.
- Test successful logout and visible logout failure. Verify expiry/revocation with isolated fixtures or separately approved throwaway staging sessions; do not alter production sessions. Existing sessions have a fixed seven-day lifetime, not rolling refresh.
- Check both organization SSE aliases through F, current-member access, cross-org rejection, and reconnect rejection within 30 seconds or earlier expiry after approved test membership/session revocation. The proxy must not buffer or cache events.
- Check gateway unconfigured/preview origins fail closed; no browser-selected upstream, forged Origin, legacy token redirect or implicit cross-origin fallback. Review cache rules to ensure auth/API traffic remains no-store.

If cutover fails, pause/review configuration or roll back to the merged **cookie-only** security baseline under separate approval. Never roll back to token URLs/storage or forward credentials between frontend origins. A new frontend host normally requires re-sign-in; no credential migration is implemented. Previously exposed sessions were not rotated/revoked by this work.

## Automated evidence

Four Chromium regressions failed before corrections: 502, 503 and network lookup failures, and unavailable-service handling with a cached identity. Final commands/results are recorded in this draft PR separately from hosted CI. The expanded browser suite executes the actual Worker handler in a local Node HTTP adapter with real API/PostgreSQL/Redis and cookie/state handling; only provider consent/token/profile HTTP and the HTTPS-to-loopback transport are test doubles. It is not proof of Cloudflare edge TLS, real provider consent, external console registration or Safari/Firefox behavior. No test launcher/control endpoint is shipped as an API entry point.

Final local results on the isolated branch:

| Check | Result |
| --- | --- |
| Clean root/frontend installs | PASS; both lockfiles unchanged |
| Production audit | PASS: 0 vulnerabilities; inherited Prisma 7.10.1 / scoped Effect 3.22.1 preserved |
| Lint/typecheck, Prisma validate/generate | PASS |
| Unit tests | PASS: 267 tests / 24 suites, 35.909s |
| Worker contract tests | PASS: 6 Node tests, included in `npm run check` |
| Real PostgreSQL/Redis integrations | PASS: 90 tests / 11 suites, 43.126s |
| Chromium | PASS: 22 tests, 2.0m; local proxy handler/API/DB/Redis, provider HTTP mocked |
| Migrations | All 13 applied fresh before regressions; repeat/status PASS; no new migration |
| Frontend/API/worker builds | PASS |
| Cloudflare bundle/configuration | Both Wrangler entry points PASS with pinned 4.166.0 `--dry-run`; **no upload** |
| Docker build/runtime smoke | PASS: live/ready, real worker queue round trip, natural shutdown |
| Read-only Prisma drift | Exit 2: only the five existing differences (four updated_at defaults, organizations.created_by index) |
| Diff whitespace | PASS |

The first implementation run exposed a module-boundary problem in the existing two storage-security VM tests; removing an unnecessary runtime import fixed it without weakening assertions. The full final suite above passed. Existing 26 development-only moderate findings, Vite chunk-size and pg concurrency warnings remain outside this focused change. CLI bundling does not test real edge TLS or provider accounts. Hosted CI results belong separately in the draft PR description; local passes must not be labeled hosted results.
