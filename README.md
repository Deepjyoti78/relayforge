# RelayForge

RelayForge is a webhook delivery and workflow orchestration project. This first
milestone establishes the backend runtime that later features will depend on.

The API and worker run as separate processes from one codebase. PostgreSQL is
the durable database. Redis and BullMQ provide background queue infrastructure.

## What works now

- **Backend Runtime:** Separate NestJS API and Worker processes from a single codebase.
- **Operational Probes:** BullMQ system queue with real end-to-end round trip worker verification.
- **Identity & Authentication:** GitHub OAuth 2.0 with PKCE (S256), short-lived state replay protection, session token SHA-256 hashing, and secure cookies (`rf_session`).
- **Organization & RBAC:** Multi-tenant organization creation, Owner/Developer/Viewer hierarchy, member invitations, and final Owner protection.
- **Row-Level Security:** Database-enforced isolation on `organizations` and `memberships` using PostgreSQL RLS, transaction-local tenant context, and recursion-free security functions.
- **Frontend Interface:** Modern, clean React + TypeScript interface for GitHub sign-in, organization selection, and member management.
- **Security & Least Privilege:** Restricted API and Worker database accounts, non-root Docker runtime, secret redaction, and bounded timeouts.
- **Infrastructure:** Persistent local PostgreSQL 17 and Redis 7.4 (AOF with `noeviction`), isolated test services, and GitHub Actions CI.

Webhook ingestion, delivery pipelines, transactional outbox, automatic retries, and dead-letter queues are part of the delivery milestones.

## Delivery Semantics & Distributed Guarantees

RelayForge provides **at-least-once delivery semantics** (never false "exactly-once" claims):
- **Downstream Deduplication:** Downstream destinations must deduplicate deliveries using the stable logical delivery identifier passed in the standard `Idempotency-Key` and `x-relayforge-delivery` headers.
- **Attempt Identification:** Individual transmissions carry a unique `x-relayforge-attempt-id`, ordinal `x-relayforge-attempt`, and fresh HMAC signature (`x-relayforge-signature`) with timestamp (`x-relayforge-timestamp`).
- **Retry Semantics:** Five attempts means **one initial attempt plus up to four retries**.
- **Bounded Backoff & Jitter:** Exponential backoff with additive uniform jitter (0–499ms), bounded at a maximum of 5 minutes (`maxDelayMs = 300000`).
- **Retry-After Adherence:** Explicitly respects destination `Retry-After` headers (both delta seconds and HTTP date), scheduling retries no earlier than requested (capped at 5 minutes).
- **Ambiguous Outcomes (`UNKNOWN`):** Network timeouts and socket resets during transport are classified as `UNKNOWN` rather than prematurely assumed failed before receipt.
- **Optimistic Concurrency:** Distributed workers use monotonic `lease_token UUID` claims with PostgreSQL row-level locks (`SKIP LOCKED`). Stale or delayed workers cannot overwrite newer worker state.
- **SSRF Hardening:** Anti-DNS rebinding via socket connection pinning, dual-homed multi-IP validation, private/cloud metadata blocking, and strict prohibition of automatic HTTP redirects (`redirect: 'manual'`).

For full technical specifications, see [Delivery Architecture](docs/delivery-architecture.md) and [Security Architecture](docs/security.md).

## Run the full application

Prerequisites: Node.js 22.20+ or 24+, npm 10+, and Docker Desktop. All commands run from this folder.

```powershell
npm ci
npm run setup
npm run db:generate
npm run build
npm run infra:up
npm run db:migrate
npm run build:web
```

To run the API and Worker on your host:
- Terminal 1: `npm run dev:api` (API on port 3100)
- Terminal 2: `npm run dev:worker` (Worker consumer)
- Terminal 3: `npm run dev:web` (Vite UI on <http://localhost:5173>)

`setup` creates local `.env` and `.env.test` files only when absent. It never
overwrites existing configuration. `stack:up` starts PostgreSQL and Redis, applies
the migration once, and starts the API and worker. The smoke test checks both API
health endpoints and submits an operational queue probe to the actual worker.

Open <http://127.0.0.1:3100/health/live> to check the API process, and
<http://127.0.0.1:3100/health/ready> to check its database dependency.
There is no dashboard in this milestone.

```powershell
docker compose --profile app logs -f api worker
npm run stack:down
```

Stopping the development stack preserves named data volumes. Do not remove those
volumes unless you intend to delete local database and queue data.

## Develop with Node on the host

Start the dependencies and migrate the development database:

```powershell
npm run infra:up
npm run db:migrate
```

Then use separate terminals for `npm run dev:api` and `npm run dev:worker`.
Node restarts each process when its imported source files change.
The API uses port 3100; PostgreSQL uses 55432 and Redis uses 56379 on loopback.
Stop the Docker API/worker first if switching from the complete stack to host
development, to avoid a port conflict and an extra worker.

## Run the checks

```powershell
npm run check
docker compose -f compose.test.yaml up -d --wait
$env:ENV_FILE = '.env.test'
npm run db:migrate
Remove-Item Env:ENV_FILE
npm run test:integration
docker compose -f compose.test.yaml down
```

The test database uses port 55433 and Redis uses 56380. The test database is
disposable and separate from development. Integration tests reject database names
that do not end in `_test`; they do not reset development tables.

`check` runs typed linting, TypeScript checking, unit/API tests, and compilation.
Integration tests verify real database permissions, worker registration, queue
communication, request IDs, and the API's independence from Redis.

The CI workflow also builds the runtime Docker image. Its paths assume this folder
is the repository root when RelayForge is published as its own repository.

## Understand the structure

```text
src/api/                    HTTP application entry point
src/worker/                 Background process and operational probes
src/modules/config/         Validated, process-specific settings
src/modules/database/       Prisma connection and runtime-role checks
src/modules/redis/          Worker Redis connection and eviction-policy checks
src/modules/observability/  JSON logs, correlation IDs, safe error fields
src/modules/health/         Liveness and readiness routes
prisma/                    Schema and immutable migration history
infra/postgres/             Local-only restricted-role provisioning
tests/                     Unit and real-service integration checks
docs/                      Design decisions and the next milestone
```

Read [the foundation walkthrough](docs/foundation.md) for the reason behind each
piece, then [the milestone plan](docs/roadmap.md) for what comes next.

## Local credentials and dependency maintenance

The checked-in credentials are intentionally public **local development defaults**.
Compose binds database and Redis ports to loopback. This Compose setup is not a
public production deployment: use unique credentials, private networking, TLS,
backups, and managed secret storage before deploying externally.

The migration login owns the schema; runtime logins cannot create databases,
create roles, act as superusers, or bypass RLS. The API can read operational worker
state; only the worker can write it. Tenant tables and RLS arrive together in the
identity/organization milestone.

Versions and the lockfile are committed together. Prisma CLI/client/adapter use
the same stable version. NestJS 11 is pinned because this Node 22/CommonJS test
setup is compatible with it; NestJS 12's ESM migration is a deliberate future
toolchain change, not an automatic dependency update.

The NestJS HTTP adapter's transitive Multer dependency is pinned to its patched
2.5.0 release using a scoped, same-major override. Review and remove this override
when the adapter's own dependency catches up.

Run `npm audit --omit=dev` for shipped dependencies and `npm audit` for development
tools. The initial full audit reports low/moderate advisories in test/lint tooling;
do not apply `npm audit fix --force` or unverified cross-major overrides. Runtime
advisories are checked separately in CI. Recheck reports as dependency releases
change.
