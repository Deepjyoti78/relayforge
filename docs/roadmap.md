# Implementation roadmap

## Current milestone: backend foundation

API and worker entry points, PostgreSQL/Redis infrastructure, restricted database
roles, Prisma migration, health checks, structured logs, operational probes,
automated checks, and container/CI definitions.

Verification results for a given development run are reported in the chat; the
presence of a CI file is not evidence of a completed remote GitHub Actions run.

## Next: identity and organization isolation

Implement external login and server-side sessions, users and memberships,
Owner/Developer/Viewer permissions, authorized tenant context, composite foreign
keys, and PostgreSQL RLS together. Test cross-tenant reads, writes, and pooled
connection reuse before adding event data.

## Then

1. API keys, encrypted secrets, and approved destinations.
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
