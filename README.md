# RelayForge

RelayForge is an enterprise-grade webhook delivery gateway and distributed sequential workflow orchestration platform.

Engineered with a zero-trust security model and distributed-systems correctness, RelayForge ingests untrusted inbound webhooks with transactional durability, prevents outbound SSRF and DNS rebinding attacks via socket-level IP pinning, executes isolated sequential multi-step workflows, and guarantees at-least-once HTTP delivery with jittered exponential backoff and rate-limited dispatch.

---

## Key Architecture & Core Capabilities

- **Transactional Outbox Engine:** Ingested webhooks are written atomically alongside transactional outbox records inside PostgreSQL transactions, guaranteeing zero message loss even under sudden process crashes.
- **SSRF & DNS Rebinding Elimination:** Custom `undici` socket-level IP pinning verifies all resolved IPv4/IPv6 addresses, eliminates TOCTOU DNS rebinding vulnerabilities, rejects internal and cloud metadata IP ranges (`169.254.169.254`, `fd00:ec2::254`), and strictly disables automatic HTTP redirects (`redirect: 'manual'`).
- **Distributed Sequential Workflow Engine:** Durable multi-step pipeline execution supporting Webhook Triggers → ALL/ANY Condition Groups → JSON Path Mapping & Transformations → Multiple Sequential HTTP Actions with checkpointed state.
- **Tenant Isolation with PostgreSQL RLS:** Native PostgreSQL Row-Level Security (RLS) policies scoped by `app.current_org_id` enforce total multi-tenant isolation across all tables.
- **At-Least-Once Delivery Semantics:** Distributed workers claim outbox batches using pessimistic row-level locking (`SELECT FOR UPDATE SKIP LOCKED`) and monotonic lease tokens with fenced crash recovery.
- **Destination Rate Limiting & DLQ:** Atomic Redis sliding-window token bucket limits dispatch rates per destination with non-destructive outbox postpone. Advanced Dead Letter Queue (DLQ) console supports categorized filtering and bulk replay.
- **Monochromatic Management Console:** High-contrast dark developer console with visual sequential workflow designer, real-time Server-Sent Events (SSE) telemetry, metrics dashboard, in-app modal confirmations (zero browser dialogs), and a split-pane sign-in modal.

---

## Technical Documentation Index

- [Production Security Review](docs/production-security.md) — Complete AppSec audit, RLS policies, SSRF defenses, and cryptographic guarantees.
- [Production Deployment Guide](docs/deployment.md) — Hosting evaluations (Render, Railway, AWS ECS), container topology, and zero-downtime rolling deploys.
- [Database Backup & Recovery Runbook](docs/backup-and-recovery.md) — Automated backup utilities, restoration drills, PITR, and migration disaster recovery.
- [Operations & Incident Runbook](docs/operations-runbook.md) — Golden signals, alert thresholds, and incident playbooks for workers, backlogs, and DLQ spikes.
- [Performance & Scalability Results](docs/performance-results.md) — Real measured throughput (RPS), p50/p95/p99 latency quantiles, and sizing recommendations.
- [Sequential Workflow Engine](docs/workflow-engine.md) — Workflow DSL specification, version immutability, and checkpointing.
- [Delivery Architecture](docs/delivery-architecture.md) — Outbox state machines, retry schedules, and optimistic concurrency.
- [Product Implementation Roadmap](docs/roadmap.md) — Comprehensive history and completion matrix of Milestones 1 through 6.

---

## Quickstart & Local Development

### Prerequisites
- Node.js 22.20+ or 24+
- npm 10+
- Docker Desktop

### 1. Initialize Infrastructure & Dependencies
```bash
npm ci
npm run setup
npm run db:generate
npm run infra:up
npm run db:migrate
npm run build
npm run build:web
```

### 2. Start Local Development Services
- **Terminal 1 (API Server):**
  ```bash
  npm run dev:api
  ```
  API available on `http://127.0.0.1:3100` (`/health/live`, `/health/ready`).

- **Terminal 2 (Outbox Worker):**
  ```bash
  npm run dev:worker
  ```

- **Terminal 3 (Web Console):**
  ```bash
  npm run dev:web
  ```
  Console accessible at `http://localhost:5173`.

---

## Production Operations & Verification Commands

```bash
# Full Quality Check (Lint, Typecheck, Unit Tests, Build)
npm run check

# Integration Test Suite
npm run test:integration

# Automated Database Backup
npm run db:backup

# Database Restore Verification Drill (Disposable Database)
npm run db:restore

# Worker Health Probe
npm run healthcheck:worker
```
