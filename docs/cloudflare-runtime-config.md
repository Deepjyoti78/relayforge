# Cloudflare runtime configuration — existing relayforge Worker

Prepared 24 November 2026 from staging `43396bf` (merged readiness PR #4). The operator confirmed:

| Setting | Confirmed value |
| --- | --- |
| Existing Worker name | `relayforge` |
| Public frontend | `https://relayforge.deepmuse.workers.dev` |
| Render upstream | `https://relayforge-staging-api.onrender.com` |

The operator has **not verified** current Workers Builds root/build/deploy/preview settings and instructed that these changes stay local. No push, draft PR, hosted CI trigger, deployment, secret update or live setting change was performed. A local draft PR description is prepared for later publication after trigger safety is confirmed.

## Root cause and source correction

Workers Builds variables exist in the build process; they do not automatically become Worker `env` values. The Worker reads runtime `env.FRONTEND_URL` and `env.API_ORIGIN`. Staging's two Wrangler files omitted `vars`, so the deployed handler could have `ASSETS` but no required public origins and return `Authentication gateway is not configured.`

Both `wrangler.jsonc` and `web/wrangler.jsonc` now declare:

```json
"vars": {
  "FRONTEND_URL": "https://relayforge.deepmuse.workers.dev",
  "API_ORIGIN": "https://relayforge-staging-api.onrender.com"
}
```

The name remains **relayforge** in both files. Main scripts, compatibility date, asset directories, `ASSETS`, reserved routes and SPA fallback are unchanged. The Worker code and OAuth/session/CORS/CSRF implementations are unchanged. No resource Bindings-menu change is needed for this correction.

These two nonsecret values are now source-owned and reapplied by Wrangler on deployment. This does not rely on `keep_vars` preserving dashboard drift or on build environment variables masquerading as runtime bindings. There is no secret in `vars`; preserve existing secrets through the normal approved operations process.

References: [Builds variables and commands](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [runtime vars](https://developers.cloudflare.com/workers/configuration/environment-variables/), [Wrangler source of truth](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Required Builds wiring — operator comparison, not claimed live settings

Recommended canonical setup in the existing Worker's **Builds** settings:

| Field | Intended value |
| --- | --- |
| Repository | `Deepjyoti78/relayforge` |
| Approved release branch | `release/staging-deployment` |
| Root directory | Repository root (`/`, or the UI's equivalent blank root) |
| Worker identity/account | Existing `relayforge` in the account serving `deepmuse.workers.dev` |
| Build command | `npm ci --include=dev && npm --prefix web ci --include=dev && VITE_API_URL=/ npm --prefix web run build && npm run check:cloudflare` |
| Deploy command, **only after approval** | `npm run check:cloudflare && npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --config wrangler.jsonc` |

The Builds command uses its Linux shell; PowerShell commands are below. `VITE_API_URL=/` is genuinely a frontend **build-time** setting. `FRONTEND_URL` and `API_ORIGIN` are supplied at runtime by checked-in Wrangler `vars`.

If the operator deliberately retains **web** as the Builds root, use matching commands rather than assuming root autodetection:

- Build: `npm --prefix .. ci --include=dev && npm ci --include=dev && VITE_API_URL=/ npm run build && npm --prefix .. run check:cloudflare`
- Approved deploy: `npm --prefix .. run check:cloudflare && npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --config wrangler.jsonc`

In that case the deploy command explicitly selects `web/wrangler.jsonc` relative to the web working directory. Both entry points resolve to the same Worker/assets and declare the same variables. The validator always resolves paths from the repository, independent of its caller's directory.

Do not add `--name relayforge-staging`, `--env staging`, `--var` overrides or framework autoconfiguration. Named environments can select a different Worker and do not inherit `vars` automatically. An unexpected `.wrangler/deploy/config.json` can redirect configuration selection; validation rejects such files in the relevant directory ancestry instead of deleting or trusting them. No Cloudflare Vite plugin/generated configuration is needed here.

Before any branch push/PR publication, verify production and preview build triggers cannot publish it. A draft PR is not a deployment freeze. Do not assume Pages-specific skip markers disable Workers Builds. The operator explicitly requested local-only work until this is known. Before the eventual merge/publish, verify Render auto-deploy/Blueprint sync and Cloudflare trigger controls separately; this task changes none of them.

## Automated bundle and runtime-binding validation

`npm run check:cloudflare` uses pinned Wrangler 4.166.0. For **both** explicit configurations it:

1. Checks the existing Worker identity and exact required public `vars`.
2. Rejects unexpected generated deployment redirect files.
3. Produces a local `deploy --dry-run` bundle and checks the deployment report contains `ASSETS`, `FRONTEND_URL` and `API_ORIGIN`.
4. Generates strict binding declarations with `wrangler types` and checks the **full literal values**. The normal console table truncates the upstream URL, so matching that prefix alone would be insufficient.
5. Records the bundle SHA-256 and validated public bindings in `.cache/cloudflare-runtime/validated-bindings.json`.

Runtime variables are deployment binding metadata injected into `env`, not constants that must appear inside Worker JavaScript. The validator checks Wrangler's effective bindings and its actual generated bundle, rather than grepping JS for URLs. All commands in the validator are local dry-run/type generation; none uploads a version or changes traffic. CI's former bundle-only step now invokes this validation.

The configuration regression fails against the old files (required vars missing) and passes after the correction. Negative tests reject omitted vars, a renamed Worker, generic/truncated binding values and generated-config redirection. Existing proxy/cookie/redirect/SSE browser coverage remains intact.

## Controlled deployment commands — existing Worker, not executed here

From the repository root, after code review and explicit deployment approval, verify the authenticated Cloudflare account owns the existing `relayforge.deepmuse.workers.dev` Worker. Review actual Builds commands first so a source push does not unexpectedly publish. Do not create or rename a Worker.

```powershell
$env:VITE_API_URL = '/'
$env:WRANGLER_SEND_METRICS = 'false'
npm ci --include=dev
npm --prefix web ci --include=dev
npm --prefix web run build
npm run check:cloudflare

# OPERATOR ONLY: run only after separate deployment approval.
# No --name, --env or --var override: the checked-in root config targets relayforge.
npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --config wrangler.jsonc
```

Alternatively, from web after those root checks: `npm exec --yes --package=wrangler@4.166.0 -- wrangler deploy --config wrangler.jsonc` selects the preserved web entry point. Use one publish path, not both. This only describes the controlled command; no publish was performed.

After approved publication, check the existing URL and record the deployment/version ID without secret values:

- `/health/live` should reach the API rather than the missing-configuration response.
- Start a **fresh** OAuth attempt from the landing modal at `https://relayforge.deepmuse.workers.dev`. Old pending callbacks may lack the frontend's browser-binding cookie and must not bypass state verification.
- Both provider starts must advertise callbacks on the Cloudflare frontend, set the HttpOnly/Secure/Lax browser-binding cookie, and be no-store. Successful callbacks must clear that binding, set a host-only session cookie, and reach dashboard/onboarding as appropriate.
- Verify `/v1/me`, refresh, logout and SSE through the frontend with third-party cookies blocked. No token URL, postMessage transfer, localStorage credential or permissive origin fallback is acceptable.

## render.yaml audit — proposed corrections only

`render.yaml` is deliberately **unchanged** in this branch. Its API source settings still declare the old Render frontend and callbacks on the API hostname; live dashboard overrides may already differ. Compare the live values before any correction. Its API build currently executes `scripts/staging-db-init.cjs` and `prisma migrate deploy`. Do not sync/deploy that blueprint as a shortcut to fixing Worker variables.

Proposed API source/runtime values, for a separately approved change after freezing automation:

| Key | Stale source value | Proposed value |
| --- | --- | --- |
| `FRONTEND_URL` | `https://relayforge-staging-web.onrender.com` | `https://relayforge.deepmuse.workers.dev` |
| `GITHUB_CALLBACK_URL` | `https://relayforge-staging-api.onrender.com/auth/github/callback` | `https://relayforge.deepmuse.workers.dev/auth/github/callback` |
| `GOOGLE_CALLBACK_URL` | `https://relayforge-staging-api.onrender.com/auth/google/callback` | `https://relayforge.deepmuse.workers.dev/auth/google/callback` |
| `SESSION_COOKIE_SAME_SITE` | Omitted (legacy production default None) | `lax` explicitly |

Keep `NODE_ENV=production`, the existing stable cookie name, encryption key, client credentials and database/Redis connections. Compare provider-console registrations with those exact callback URLs; do not change them or credentials in this task. Do not broaden CORS to support a stale frontend.

The proposed **compile-only** API build command is `npm ci --include=dev && npm run build`. The existing build script generates Prisma and compiles TypeScript; it does not initialize database roles or apply migrations. Remove the initializer/migration commands only in a separately reviewed source/operations change; do not run them here. Any genuinely required future migration needs its own approval and isolated validation.

The legacy Render static frontend is not the Cloudflare Worker. Do **not** set its `VITE_API_URL=/` as though it had this proxy. Its future retirement/redirect is a separate decision. The existing shared API/worker database-URL mapping and cloud TLS verification gaps also remain separate release concerns; delivery PR #3 is not changed.

## Validation evidence

Local validation on this branch (24 November 2026):

| Check | Result |
| --- | --- |
| Clean root and frontend `npm ci` | Passed; lockfiles unchanged |
| Production `npm audit --omit=dev --audit-level=moderate` | Passed, 0 vulnerabilities |
| `npm run check` | Passed: lint, typecheck, 267 unit tests across 24 suites, proxy tests and API/worker build |
| Final `node --test web/tests/worker.test.mjs` | 9 passed, 0 failed/skipped; original missing-vars reproduction was 1 failed / 5 passed |
| Prisma generation and schema validation | Passed, Prisma 7.10.1 |
| Isolated PostgreSQL/Redis integration | 90 passed across 11 suites |
| Isolated migrations | All 13 applied to a fresh local test database; repeat deployment and status passed |
| Frontend production build (`VITE_API_URL=/`) | Passed |
| `npm run check:cloudflare` | Both root/web configurations passed dry-run bundling and exact runtime-binding validation |
| Chromium `npm run test:browser` | 22 passed, 0 failed/skipped |
| Docker runtime-target build | Passed |

Database checks used only `relayforge_cf_runtime_test` on local PostgreSQL port 55434 and local Redis port 56381, database 4, with an isolated queue prefix. No deployed database was contacted. Detailed local logs and machine-readable results are retained under `.cache/cloudflare-*.log` and `.cache/cloudflare-results.json`; final proxy results are in `.cache/proxy-final.log`.

Existing nonblocking warnings remain: 26 development dependency audit findings during installation, the frontend chunk-size warning, and PostgreSQL client's concurrent-query deprecation warning in integration tests. No dependency or schema changes were made to suppress them.

Hosted GitHub Actions and actual Workers Builds settings/publishing remain **not run / not verified**, not successful checks. The updated CI workflow is prepared, but local-only publication instructions prevent triggering it. No real provider login, live migration or deployment is part of these checks.
