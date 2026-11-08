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

## Completed: Milestone 3 — API keys, encrypted secrets, approved destinations, and transactional delivery

1. Organization-scoped API keys (SHA-256 hashed storage, prefixes, immediate revocation).
2. AES-256-GCM envelope encryption for webhook secrets with HMAC-SHA256 signing.
3. Destination registry with SSRF protection, strict IPv4/IPv6 private IP filtering, DNS rebinding socket-pinning, and disabled redirects.
4. Signed ingestion with deduplication via PostgreSQL transactions and transactional outbox pattern.
5. Durable HTTP deliveries with worker leases (`claim_pending_outbox_messages` via `FOR UPDATE SKIP LOCKED`), crash recovery, and dead letter queue.
6. Exponential retry backoff with jitter and RFC-compliant `Retry-After` parsing.

## Completed: Milestone 4 — Sequential Workflow Execution Engine

1. Durable sequential workflow execution engine: Webhook Trigger → Condition Groups → Bounded JSON Transform → Sequential HTTP Actions.
2. Immutable published workflow versions (`workflow_versions`) with deterministic SHA-256 definition digests.
3. PostgreSQL Row-Level Security across workflows, versions, executions, and step execution checkpoints.
4. Bounded expression DSL: ALL/ANY condition groups and safe JSON path mapping (dot/bracket notation, prototype pollution prevention, 10-depth limit).
5. Checkpointed step transitions (`workflow_step_executions`) ensuring previously succeeded actions are never re-executed on resume.
6. Stable downstream idempotency keys (`wf_${executionId}_${nodeId}`).
7. Monochromatic Management Console with visual sequential flow canvas, live definition validation, immutable publication, execution lineage timeline, and in-app modal confirmations (zero browser dialogs).
