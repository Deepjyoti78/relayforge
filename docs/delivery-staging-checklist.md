# Delivery integration and controlled staging acceptance

Prepared 24 November 2026 against staging `826bd83`. GitHub shows PR #3 was
merged into its old dependency branch as `0f939d0`, not staging. The isolated
`codex/webhook-delivery-staging` branch cherry-picks only its four delivery
commits (`2152c9a`, `d18e103`, `3d49d13`, `91f280f`). A merged PR cannot be
retargeted; this work needs a replacement draft against staging, linked to #3.
No merge, deployment, live database query/migration or secret change is performed.
The operator initially held publication while Cloudflare/Render trigger safety was
unverified. On 24 November the operator confirmed those controls are safe for
`codex/webhook-delivery-staging` and authorized its push, replacement draft PR and
hosted CI. This authorization does not permit merge, deployment or live migration.

## Conflict resolution and preserved implementation

The README keeps staging's corrected tenant/RLS description while updating only
delivery semantics. `docs/deployment.md` keeps staging's complete authentication
and hosting guide instead of restoring the obsolete deployment template text.
The OAuth regression file, Chromium suite, RLS initialization, frontend/session
code, Wrangler configs, CI, dependency override and lockfiles remain unchanged
relative to staging. Delivery/workflow integration fixtures retain their combined
staging identity setup and dedicated worker database connections.

## Operator gates before any deployment

1. Obtain approval for the exact reviewed commit and migration. Independently
   disable Render auto-deploy and Blueprint sync; verify Cloudflare publishing
   triggers cannot deploy this review branch. Do not treat a draft PR as a freeze.
2. Verify actual deployed API/worker versions, all worker replicas, PostgreSQL
   version, pooler behavior and Redis namespace. Sign-in working in staging is
   operator-reported evidence; it does not validate worker roles or this migration.
3. `render.yaml` is intentionally unchanged. Its API build runs
   `scripts/staging-db-init.cjs` and `prisma migrate deploy`, and its worker copies
   API `DATABASE_URL`. Do not deploy/sync it as written for this rollout. Review a
   separate compile-only API build (`npm ci --include=dev && npm run build`) and
   worker build, with migrations as an explicit approved operation. Review a
   separate worker `WORKER_DATABASE_URL` secret input instead of the API mapping.
   Do not run the role initializer as proof of least privilege; it can swallow errors.
4. Keep `DATABASE_URL` (API), `WORKER_DATABASE_URL` (worker), and
   `MIGRATION_DATABASE_URL` (migration owner) distinct. Through approved connection
   tooling, run the read-only checks below on each intended connection. Do not
   print passwords or paste URLs into tickets. The worker must log in as
   `relayforge_worker`: the origin helper checks `session_user`, so merely setting
   a role on a shared API login is insufficient. Runtime roles must not own the
   tenant tables, have SUPERUSER/BYPASSRLS, or inherit an owner role. The approved
   migration/function owner must have the privileges needed by the existing
   SECURITY DEFINER design, including forced-RLS access. Validate on a restored
   copy before live migration; this review does not verify hosted credentials.

```sql
SELECT current_database(), current_user, session_user;
SELECT rolname, rolsuper, rolbypassrls, rolinherit
FROM pg_roles WHERE rolname IN (current_user, 'relayforge_api', 'relayforge_worker');
SELECT pg_get_userbyid(c.relowner) AS owner, c.relname,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('outbox_messages','destination_deliveries');
-- After migration: worker true, API false for mutation helpers.
SELECT has_function_privilege('relayforge_worker',
  'public.begin_destination_delivery(uuid,uuid,uuid)', 'EXECUTE') AS worker_allowed,
  has_function_privilege('relayforge_api',
  'public.begin_destination_delivery(uuid,uuid,uuid)', 'EXECUTE') AS api_allowed;
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('prepare_destination_deliveries','begin_destination_delivery',
  'record_destination_result','finish_destination_batch','renew_outbox_lease');
```

5. Verify Redis `PING`, authenticated/TLS connectivity and `INFO memory`
   (`maxmemory_policy:noeviction`); review persistence, capacity, restart behavior
   and the exact shared `QUEUE_PREFIX`. If the hosted service denies CONFIG/INFO,
   obtain equivalent provider evidence. Do not use FLUSHDB/FLUSHALL. API readiness
   checks PostgreSQL, not full Redis/worker readiness. Run the application's
   `npm run healthcheck:worker` from the approved worker environment: it round-trips
   a synthetic BullMQ health job, but does not prove webhook delivery correctness.
   Redis connection/policy startup checks are advisory; destination limiting fails
   open on Redis errors. PostgreSQL outbox/state remains the delivery authority.
   Existing cloud PostgreSQL/Redis certificate-verification gaps need separate review.

## Backup, migration and rollback

Before changes, obtain an encrypted, access-controlled provider backup/PITR point
and retention approval. Restore into an isolated database and validate schema,
row counts, migration history, roles/grants/function ownership and representative
pending/successful/dead target state. Database dumps do not include cluster roles;
capture approved role/grant definitions separately without exposing passwords.
See PostgreSQL's [cluster-global backup scope](https://www.postgresql.org/docs/17/app-pg-dumpall.html).
Verify the existing `ENCRYPTION_KEY` remains available through the approved secret
store for decrypting restored endpoint secrets; never rotate or print it for a drill.
The repository `db:backup`/`db:restore` scripts target a hard-coded local container;
they are not a hosted backup procedure. The restore helper drops its target and
does not fail reliably on every SQL error; do not run it against staging/production.

For an approved direct PostgreSQL backup/restore drill, using private environment
variables already populated by approved tooling (commands shown, not run live):

```sh
# Use a compatible pg_dump version; store the artifact outside the repository.
pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE"
# RESTORE_TEST_DATABASE_URL must identify a NEW, isolated, empty database.
# Do not substitute the live database or use --clean/--create here.
pg_restore --exit-on-error --single-transaction --dbname="$RESTORE_TEST_DATABASE_URL" "$BACKUP_FILE"
```

Drain all old workers before the new migration. SIGTERM stops new claims/targets
and awaits active sweep/renewal work before closing dependencies. There is no
guaranteed finite drain time under stalled database operations; measure the host's
termination grace and inspect live work before proceeding. A forced kill leaves
ambiguous receipts for fenced recovery; never force exit to declare a drain passed.
Do not overlap old and new fanout workers. Pause ingestion too for the measured
write-lock window, or explicitly budget queued traffic and client retries.

`202611230001_destination_delivery_reliability` adds target state, an initialization
flag, composite unique index/FK, forced RLS and fixed-search-path fenced helpers.
It replaces the claim signature (two-argument callers retain defaults) and wraps
locked replay. Pending state is initialized lazily, reconciling recorded success.
The ordinary unique-index build scans `outbox_messages` and blocks writes; table
DDL also takes locks. Measure on a production-sized restored copy and review
long-running transactions before choosing the maintenance window. This is not a
concurrent-index/zero-downtime migration; see PostgreSQL's
[index locking rules](https://www.postgresql.org/docs/17/sql-createindex.html).
There is no explicit transaction wrapper in the migration. Do not assume a failed
deployment undoes every change without testing the actual Prisma 7/host path.
Rehearse recovery and inspect objects after failure; do not blindly rerun or mark
the migration applied.

After approved backup/drain/window, from the reviewed release artifact with only
the approved migration connection set:

```sh
npm run db:generate
npx prisma migrate status
npm run db:migrate
npx prisma migrate status
```

Inspect actual objects/grants and run acceptance before resuming normal traffic.
If migration fails, keep workers stopped, preserve logs and inspect partial objects
against the SQL before an approved repair; `migrate resolve` is not an automatic fix.

Code-only rollback to old fanout logic is unsafe once target state is initialized:
it can resend successful siblings and misclassify completion. Stop workers and
prefer a reviewed forward fix preserving target successes. Do not drop the state
table, clear success, reset the database or overlap old/new workers as a shortcut.
A full restore requires a new approval, stopped writers, replay/idempotency review
and acceptance of losing/reconciling all writes after the backup. Restoring SQL
cannot undo HTTP side effects already committed at receivers.

## Historical completed-event recovery

The migration does not reopen historical DISPATCHED events. Build a read-only,
organization-scoped inventory of completed coordinators with both successful and
failed attempts; correlate destination IDs, receiver receipts and configuration
history. Current destinations cannot reconstruct historical membership, and an
absence of attempts is not proof of a failed delivery. Preserve this evidence.
For each explicitly approved event/target pair, decide whether receipt is known,
unknown or failed. Use a reviewed repair plan that seeds successes and retries
only approved unfinished pairs with stable IDs. Ordinary replay rejects completed
coordinators. Do not bypass it via a blanket status UPDATE or resend with a new
event ID; ambiguous receivers must confirm deduplication before recovery.

## Staging acceptance — synthetic data and approved receivers only

Use a disposable staging organization, two test users in different organizations,
and an operator-owned HTTPS receiver explicitly approved for these tests. The
receiver must capture signatures/IDs and switch between 200/500 without redirecting.
Never use customer payloads or arbitrary public echo services. Keep production
SSRF restrictions and `ALLOW_PRIVATE_DESTINATIONS=false`; loopback bypass is only
for the isolated automated suite. No live acceptance traffic was sent by this review.

1. Log in through the existing Cloudflare origin. Create an API key via
   `POST /v1/organizations/:orgId/api-keys`, then an endpoint via `/endpoints` and
   a destination via `/destinations` with that organization's session. Keep returned
   secrets private; do not log them. **Current ingestion does not use ApiKeyGuard
   and only verifies a signature if supplied.** Creating/passing an API key is not
   evidence of key-gated ingestion. This pre-existing limitation is outside this
   delivery patch and needs a separate security decision before untrusted use.
2. Send a synthetic JSON body to `POST /v1/ingest/:endpointId`, with a fresh
   `x-idempotency-key` and valid `x-relayforge-signature` computed using
   `signWebhookPayload(rawBody, endpointSigningSecret)`. Expect 202. Repeat the
   exact request/key: expect 200/duplicate and the same event ID. A deliberately
   invalid signature must return 401. Do not exercise unsigned live ingress.
3. With receiver 200, inspect `/v1/organizations/:orgId/deliveries?eventId=...`:
   success, correct originating endpoint HMAC, one logical event/destination ID
   and completed event. Verify timestamp/body exactly at the receiver.
4. Switch one approved receiver to 500. Wait for real backoff (no live SQL deadline
   edits); inspect attempt times and eventual DLQ after five total target attempts.
   Restore 200, then replay the failed delivery with
   `POST /v1/organizations/:orgId/deliveries/:deliveryId/replay`. Expect completion;
   immediate duplicate replay and replay of an already successful event are rejected.
5. With two destinations (200/500), verify the coordinator remains pending while
   the failure retries, and the 200 receiver is not sent again. Exhaust/replay only
   the failed target; its stable delivery ID remains constant and attempt IDs vary.
6. From the other user's session, request deliveries, destinations and DLQ and
   attempt API-key creation/replay under the first organization's ID. Expect 404/403
   with no cross-tenant data or receiver calls. Anonymous management requests are
   401. Keep signature/endpoint ingestion semantics separate from tenant management.
7. Record event/destination IDs, redacted receiver evidence, version, statuses,
   timing and cleanup decisions. Revoke only the synthetic key and remove only
   approved fixtures after retaining evidence; never purge customer DLQ/history.

The automated reliability suite uses real local PostgreSQL/Redis and loopback
HTTP for mixed outcomes, signing, crash/recovery, lease loss, replay and RLS. The
new HTTP provisioning test additionally covers steps 1–3 and foreign-tenant access.
Chromium remains real-browser session/proxy coverage with mocked OAuth providers;
it does not claim live Google/GitHub consent or hosted receiver validation.

## Changed-file inventory

Delivery implementation: `src/worker/outbox-worker.service.ts`,
`src/modules/delivery/delivery.service.ts`, `src/modules/delivery/dlq.service.ts`.
Schema: `prisma/schema.prisma` and
`prisma/migrations/202611230001_destination_delivery_reliability/migration.sql`.
The migration's Git blob is identical to PR #3's final migration; no unrelated
schema repair was introduced.
Tests: `tests/delivery-reliability.integration-spec.ts`,
`tests/delivery.integration-spec.ts`, `tests/delivery.spec.ts`,
`tests/worker-shutdown.spec.ts`, `tests/workflow-execution.integration-spec.ts`.
Documentation: `README.md`, `docs/delivery-architecture.md`,
`docs/delivery-reliability-review.txt`, and this checklist.

## Combined-code validation

Local results on 24 November 2026:

| Check | Result |
| --- | --- |
| Clean root/frontend `npm ci --include=dev` | Passed; lockfiles unchanged |
| Production `npm audit --omit=dev --audit-level=moderate` | Passed, zero vulnerabilities |
| `npm run check` | Passed: lint, typecheck, 268 unit tests / 24 suites, 9 proxy tests, API/worker build |
| `npm run test:integration` | 108 passed / 12 suites, 74.913s; includes 18 reliability scenarios |
| `npm run test:browser` | 22 Chromium tests passed, 2.0m |
| Prisma generation / schema validation | Passed, Prisma 7.10.1 |
| Fresh isolated migration deployment | All 14 applied; repeat deployment and status passed |
| Frontend build (`VITE_API_URL=/`) | Passed; inherited large-chunk warning remains |
| `npm run check:cloudflare` | Root/web dry-run bundles and exact runtime bindings passed; no upload |
| Read-only Prisma migration diff | Exit 2: only the five baseline differences (four updated_at defaults and organizations.created_by index) |
| Isolated backup/restore drill | Passed: 14 migration records, 52 synthetic target rows, forced RLS and worker/API helper grants preserved |
| Local Redis / role checks | PONG, noeviction; API/worker not SUPERUSER/BYPASSRLS; only worker can execute target mutation helper |
| Docker runtime build / smoke | Passed on retry; image liveness/readiness, real BullMQ round-trip and natural API/worker close passed without forced exit |
| `git diff --check` | Passed |

The initial combined integration run had 18 setup failures (missing trusted Origin)
and 90 passes. After fixture adaptation, 107 passed and the new DLQ test alone
expected 404 instead of the implemented 403 denial. Correcting that assertion gave
the final 108 passes. No production authentication rule or lint check was bypassed.
The first Docker build failed with daemon EOF; Docker Desktop had stopped. The
unchanged build was retried after restart, retaining both logs.

Local logs/results are under `.cache/delivery-*.log` and
`.cache/delivery-results.json`; historical failed attempts are retained, not
overwritten as successes. Tests used only loopback ports 55436/56383 in a separate
disposable Compose project. No hosted database/receiver was contacted. Existing
26 development-only moderate advisories and pg concurrent-query deprecation
warnings remain; no dependency upgrade or unrelated drift repair was attempted.

Hosted GitHub CI was **not run during local preparation** under the publication
hold. Fresh hosted results for the published head are recorded separately in the
replacement PR; historical PR #3 CI does not validate this combined staging code.
Real hosted role/Redis/backup validation, receiver acceptance and release approval
remain operator gates, even though staging Google/GitHub sign-in is reported working.
