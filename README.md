# RelayForge

RelayForge is a webhook delivery and workflow orchestration project. This first
milestone establishes the backend runtime that later features will depend on.

The API and worker run as separate processes from one codebase. PostgreSQL is
the durable database. Redis and BullMQ provide background queue infrastructure.

## What works now

- NestJS API with liveness and PostgreSQL readiness endpoints.
- A separate NestJS worker with a BullMQ operational-probe consumer.
- A real queue round trip that checks the worker and its database connection.
- Prisma schema, checked-in migration, and restricted API/worker database accounts.
- Worker heartbeat registration, refresh, and graceful cleanup.
- Validated environment settings and bounded database connection/query timeouts.
- Structured JSON logs, server-generated request IDs, and secret redaction.
- Persistent local PostgreSQL and Redis, plus isolated disposable test services.
- Multi-stage Docker builds and a GitHub Actions verification workflow.

Authentication, organizations, tenant RLS policies, webhook ingestion, delivery,
retries, outbox processing, and the frontend are later milestones. The operational
probe is infrastructure verification; it does not simulate webhook delivery.

## Run the complete foundation

Prerequisites: Node.js 22.20+ or 24+, npm 10+, and a running Docker Desktop using
Linux containers. All commands below run from this folder.

```powershell
npm ci
npm run setup
npm run db:generate
npm run build
npm run stack:up
npm run test:smoke
```

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
