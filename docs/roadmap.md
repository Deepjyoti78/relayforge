# Implementation roadmap

## Completed: Milestone 1 — Backend foundation

API and worker entry points, PostgreSQL/Redis infrastructure, restricted database
roles, Prisma migration, health checks, structured logs, operational probes,
automated checks, and container/CI definitions.

## Completed: Milestone 2 — Identity, organizations, and multi-tenant isolation

GitHub OAuth 2.0 with PKCE and state protection, server-side session hashing,
user profiles, multi-organization membership, Owner/Developer/Viewer RBAC,
transaction-local tenant context, PostgreSQL Row-Level Security (RLS) enforcement,
and minimal React/TypeScript management UI.

## Next: Milestone 3 — API keys, encrypted secrets, and approved destinations

1. Organization-scoped API keys (hashed storage, prefix, rotation).
2. AES-256-GCM envelope encryption for webhook secrets.
3. Destination registry and egress URL policy verification (SSRF protection).
4. Immutable workflow publication and endpoint configuration.
2. Endpoint configuration and immutable bounded workflow publication.
3. Signed ingestion, schema validation, deduplication, and transactional outbox.
4. One real HTTP delivery with leases and durable attempt records.
5. Retry scheduling, unknown outcomes, dead letters, and crash recovery.
6. Sequential action progression and failed-step resume.
7. Operational UI, execution history, and durable SSE.
8. Deployment verification, load measurements, backup/restore, and runbooks.

Every accepted event will use a frozen workflow version. Automatic retries may
repeat HTTP requests; downstream idempotency is required to prevent duplicate
external side effects. Failed-step resume will preserve completed steps.

Arbitrary workflow graphs, loops, user code, collaborative editing, and
compensation are outside the first release.
