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

## Completed: Milestone 5 — Real-Time Operational Observability, Destination Rate Limiting & Advanced DLQ Management

1. **Per-Destination Sliding-Window Rate Limiting:**
   - Atomic Redis token bucket via embedded Lua script enforcing `rate_limit_per_second` per target destination.
   - Non-destructive outbox postpone procedure (`postpone_outbox_rate_limit`) resetting worker lease tokens and delaying next attempt without consuming customer retry quota during destination rate spikes.
2. **Real-Time Telemetry & Server-Sent Events (SSE):**
   - Redis Pub/Sub multiplexer streaming live pipeline telemetry (`webhook.ingested`, `delivery.attempt`, `workflow.step`, `workflow.completed`, `dlq.routed`).
   - Resilient `@Sse('events/stream')` endpoint with automated 15-second keep-alive heartbeats and tenant isolation.
3. **Advanced Dead Letter Queue (DLQ) Management & Bulk Replay:**
   - Classification filter by failure categories: `PERMANENT_HTTP` (4xx), `EXHAUSTED_RETRIES`, `SSRF_BLOCKED`, and `TIMEOUT` (408/504).
   - Atomic bulk replay (up to 100 messages) with `FOR UPDATE SKIP LOCKED` and lease expiration protection (`lease_expires_at <= NOW()`).
   - Single message permanent purge capability.
4. **Statistical Metrics & Latency Quantiles:**
   - Ingestion throughput, outbox lag seconds, delivery success/failure rates, and p50, p95, p99 millisecond latency sampling.
5. **Monochromatic Dashboard Enhancements:**
   - Real-time streaming event console with pause/resume and auto-scroll terminal.
   - Interactive DLQ management console with multi-select checkboxes and error inspector drawer.
   - Restricting stat cards strictly to the Overview section, fixing boundary line spacing to prevent card clipping, and replacing 100% of browser popups with custom in-app confirmation dialogs.

## Completed: Milestone 6 — Production Hardening & Deployment

1. **Split-Pane Sign-In Modal & Landing Experience:**
   - Monochromatic public landing page with one-click "Sign In" trigger.
   - Split-pane authentication modal: left-side branded design system artwork card; right-side GitHub OAuth flow with fallback session token entry and security guardrail badges.
2. **Independent Security Audit & Hardening:**
   - Verified zero-trust SSRF defense with socket IP pinning and disabled HTTP redirects.
   - PostgreSQL RLS tenant isolation enforced across all database queries via `app.current_org_id`.
   - Comprehensive AppSec reference documented in `docs/production-security.md`.
3. **Production Configuration & Environment Validation:**
   - Strict runtime configuration schema (`src/modules/config/environment.ts`) rejecting insecure placeholder keys, default passwords, and private destination flags in production.
   - Sanitized `.env.production.example` template with clear guidance.
4. **Disaster Recovery & Database Operations:**
   - Automated zero-downtime backup utility (`scripts/backup-db.cjs`) and restoration drill script (`scripts/restore-db.cjs`).
   - Validated restoration drill into disposable test database verifying schema and table consistency.
   - Comprehensive recovery runbook and migration troubleshooting guide in `docs/backup-and-recovery.md`.
5. **Operations Runbook & Golden Signals:**
   - Incident response playbooks for worker crash recovery, outbox backlog growth, and DLQ spikes in `docs/operations-runbook.md`.
   - Clear alerting thresholds for worker heartbeats, outbox lag, and destination rate limiting.
6. **Performance & Scalability Results:**
   - Documented throughput, p50/p95/p99 latency quantiles, and scaling recommendations in `docs/performance-results.md`.
7. **CI/CD Pipeline & Packaging:**
   - Automated multi-stage GitHub Actions workflow in `.github/workflows/deploy.yml` with linting, strict typechecks, unit tests, integration tests, container image compilation, and migration checks.
8. **Deployment Architecture Guide:**
   - Complete hosting evaluation (Render vs Railway vs AWS) with cost breakdown and topology diagrams in `docs/deployment.md`.
