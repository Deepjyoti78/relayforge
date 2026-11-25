# RelayForge status audit — 26 November 2026

## Assessment and scope

RelayForge is a functional staging MVP with substantial automated coverage. It
is not yet ready for an unqualified production release. Core implementation and
passing CI are ahead of verified hosted operations and deployment safety.

This review refreshed origin refs, independently read GitHub PR/run/job metadata,
and inspected authentication, proxy, tenant context, ingestion, delivery, retry,
worker, Redis/database, deployment, CI and recovery code. It is a source/readiness
audit, not an exhaustive penetration test, load test or proof of hosted state.
No live database, provider console, credentials or hosting settings were accessed.

## Actual integration state

Remote staging remains `d5552a7fdc66bf0d9794894162bdf57344dcbd53`.
GitHub confirms #1 (auth), #2 (dependencies), #4 (same-origin/session readiness),
#5 (Cloudflare runtime config), and #6 (delivery reliability) merged into staging.
#3 merged into the old dependency branch; #6 is its staging replacement.

- Staging includes browser-bound Google/GitHub OAuth state and PKCE, HttpOnly
  production Secure session cookies, strict frontend-origin CSRF/CORS, hashed
  server sessions, logout/revocation checks, user/tenant RLS context and authorized
  SSE. Streams end after at most 30 seconds, or session expiry, then reconnect
  through authorization; revocation is bounded rather than instantaneous.
- Staging includes fixed-upstream Cloudflare proxy, no-store streamed responses,
  required runtime origins in both Wrangler configs and token-redirect rejection.
- Staging includes per-destination retries, successful-target preservation,
  origin-endpoint signing, one-at-a-time claims, renewable fenced leases, DLQ
  and target replay. It provides at-least-once attempts; remote receipt followed
  by a crash/timeout remains ambiguous. Receivers must honor idempotency keys.
- Prisma 7.10.1 retains the scoped `@prisma/config@7.10.1 -> effect@3.22.1`
  override. The production audit rerun during this review reports zero findings.
- Pushed UI branch `codex/landing-loading-polish` is at `5c2e8e3`, not merged.
  The newer two-line wording/light sans typography, sample delivery ticker and
  removal of the trust/technology-logo strip remain local working changes.
- `codex/redis-runtime-reliability` at `a108190` and its inherited Render safety
  preparation `edb4601` remain local, not integrated into staging. The original
  `codex/render-release-safety` worktree remains preserved at `b2d336c`.
- The main workspace checkout is stale local staging `27e8c5b`. The current UI
  server runs from its isolated worktree based on `d5552a7`; do not confuse them.

## Release-blocking findings, in priority order

| Priority | Evidence | Consequence / next action |
| --- | --- | --- |
| High | `src/modules/ingestion/ingestion.controller.ts` exposes POST `:endpointId` without ApiKeyGuard; `ingestion.service.ts` only verifies a signature when present | Knowing an active endpoint ID permits unsigned submissions. Decide and implement authenticated ingress before untrusted use; creating an API key currently does not gate ingestion. Do not weaken legitimate provider verification. |
| High | `render.yaml` API build runs `staging-db-init.cjs` and `prisma migrate deploy` | Routine builds can mutate schema/roles. Review and integrate compile-only builds; migrations need an explicit controlled operation. Actual live build commands are not verified. |
| High | `render.yaml` maps worker WORKER_DATABASE_URL from API DATABASE_URL | Dedicated worker identity is not established by this blueprint. Verify actual session_user, least privilege, SECURITY DEFINER ownership/grants and forced RLS. The delivery migration grants worker-only operations. |
| High | Staging `redis.service.ts` and cloud branch of `database.service.ts` use `rejectUnauthorized:false` | Certificates are not verified. The local Redis branch corrects Redis TLS, but PostgreSQL verification remains separate work. Validate trusted CAs and actual cloud connectivity before rollout. |
| High | Operator reported Redis close/reconnect loops; current Redis foreground client uses unlimited per-request retries, and worker HTTP health starts before app bootstrap | PONG/queue/delivery health cannot be inferred from HTTP 200. Live cause remains unknown. Review local Redis recovery/shutdown/diagnostic corrections and verify them from Render's network. |
| Release gate | Prior credential exposure was reported; rotation is not independently confirmed | Treat rotation completion as unverified. Use the coordinated operator procedure; no secret was read, changed or rotated during this audit. |
| Release gate | Delivery migration is in source, but hosted migration status, worker SHA, backup/restore and roles are unverified | Drain all old workers, verify a restored backup/roles, measure index/DDL locks and separately approve migration. Historical completed mixed outcomes need scoped reconciliation; never blanket reset or rerun successful targets. Old fanout rollback after initialization is unsafe. |
| Medium | `delivery.service.ts` calls `res.text()` before truncating preview to 2048 bytes | Preview storage is bounded, but response buffering is not byte-bounded. A large/hostile destination response can consume memory. Add bounded streaming reads with cleanup and targeted tests in a separate reliability change. Source finding; no destructive/OOM experiment was run. |
| Medium | `scripts/restore-db.cjs` interpolates target names into shell/SQL, drops the chosen DB in a fixed local container, and omits psql ON_ERROR_STOP | This is not approved hosted recovery tooling. Do not use with untrusted arguments or production connections; replace with validated, failure-safe isolated tooling before relying on recovery. |
| Medium | Render blueprint retains old Render frontend/provider callbacks and free web-service worker topology | Broad Blueprint sync could overwrite working Cloudflare OAuth overrides. Audit actual settings; verify always-on worker requirements and cost/availability choices before promises of continuous processing. |

Additional limitations: API readiness is PostgreSQL-only; Redis limiting is
documented fail-open, with foreground waits problematic on staging; no proven
hosted alerting/SLO/capacity/restore acceptance evidence was obtained. Cookie
SameSite defaults to None in production unless explicitly configured; same-origin
Cloudflare deployment should explicitly use `SESSION_COOKIE_SAME_SITE=lax` and
callbacks at the public Worker origin. Do not restore browser-stored tokens.

## Verified hosted CI, separate from current local tests

The GitHub Actions API and job steps were inspected, not just PR descriptions.

| Code | Run | Result |
| --- | --- | --- |
| Staging `d5552a7` | [45381111119](https://github.com/Deepjyoti78/relayforge/actions/runs/45381111119) | verify SUCCESS; browser-authentication SUCCESS |
| Pushed UI `5c2e8e3` | [45683290883](https://github.com/Deepjyoti78/relayforge/actions/runs/45683290883) | verify SUCCESS; browser-authentication SUCCESS |

Both verify jobs passed installation, generation, production audit, check
(lint/typecheck/unit/proxy/backend build), frontend build, both Wrangler no-upload
checks, isolated services/migrations/integration and Docker build. Browser jobs
passed Chromium. Neither job failed or was skipped; only the conditional failure
log step was skipped. Hosted databases were not migrated by these test runs.
These runs do not cover today's unpushed wording/typography changes or the local
Redis branch. OAuth HTTP providers are mocked in automated browser tests.

## Local evidence and limits

- Current production npm audit: 0 vulnerabilities. No package upgrades performed.
- Current UI regression suite: 7 Chromium cases passed in 31.4 seconds, including
  pending-session landing/login, protected retry, verified dashboard reload,
  light sans computed styles and exactly two full headline lines at 320, 390,
  768, 1280 and 1860 pixels. API responses are synthetic.
- Final follow-up after ticker/trust-strip edits: 9 Chromium cases passed in
  32.7 seconds, including sample labeling, ticker hover pause (manual pause button removed per user request), static reduced-motion
  layout and removed-section absence. Final frontend build passed: entry
  408.44 kB / 104.98 kB gzip. The scoped UI detector returned no findings.
- Current frontend TypeScript/Vite build passed: entry 411.56 kB / 105.00 kB gzip,
  versus 578.74 kB / 131.63 kB before dashboard splitting. No hosted timing claim.
- Earlier checks in this UI worktree passed lint, root typecheck and 9 proxy
  tests. Current git diff whitespace validation passed.
- A restricted-sandbox unit run failed 12 tests (including DNS-dependent SSRF
  fixtures and the spawned dependency probe). With normal network/process access,
  267/268 tests passed; the one failure was the randomized tag-tampering test at
  `tests/endpoints-ingestion.spec.ts:46`. It replaces the first tag byte with 00,
  which does not mutate a tag already beginning in 00 (1/256 probability).
  The observed failure is consistent with this fixture defect; it does not by
  itself establish a decryption vulnerability. The unchanged full rerun passed
  all 268 tests / 24 suites in 64.13 seconds. Retain the failure evidence and fix
  this fixture deterministically in separate test maintenance.
- Full PostgreSQL/Redis integration, Docker and real-cookie OAuth tests were not
  rerun locally during this review because Docker's Linux engine was stopped.
  Passing hosted results above are independently verified historical evidence.
- Prior isolated schema diff found five baseline differences (four updated_at
  defaults and organizations.created_by index); no new live schema comparison.
- Prior local Redis-branch evidence (296 unit / 115 integration / 22 Chromium,
  Docker/natural shutdown and restore) applies only to that branch; it is not
  evidence that its fixes are merged or deployed.

The landing dashboard illustration has synthetic counters and animations; it
does not measure hosted system health. The trust/technology-logo strip has been
removed locally at the user's request. The new delivery ticker is explicitly
labeled illustrative, with no customer data or claimed production metrics.
Maintainability also needs attention: OrgManagement and SignIn are large
components with extensive inline styles, while global !important rules force
scoped typography overrides. Refactor incrementally after release blockers.

## Suggested next release sequence

1. Resolve the ingress authentication policy and prioritize verified cloud TLS.
2. Review the local Redis/Render safety branch, keeping unrelated UI separate.
   Confirm branch publishing controls before publication; then require hosted CI.
3. Independently verify deployed API/worker commits, actual build commands and
   deployment controls; coordinate any still-required credential rotation.
4. Verify restricted API/worker/migration identities, migration 14 and grants,
   Redis PONG/queue health, capacity, retention and restored-backup evidence.
5. Approve an exact controlled rollout: freeze/drain all workers, separately
   migrate if needed, deploy API/one worker, then synthetic owned-receiver
   acceptance (success, duplicate, 500/retry/replay, mixed targets, tenant denial).
6. Test real Google/GitHub consent, reload/logout and cookie persistence at the
   Cloudflare origin. Operator previously reported working sign-in; this review
   did not repeat it or inspect provider consoles.
7. Release the UI review only after the local follow-up is committed/pushed and
   its exact-head CI passes. Do not infer deployment from a branch push.
8. Establish alerting, queue/delivery SLOs, hosted restore rehearsal and sustained
   load/availability evidence before production approval.
