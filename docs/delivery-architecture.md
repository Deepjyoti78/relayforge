# Webhook delivery guarantees

RelayForge durably queues an accepted event and makes bounded, at-least-once delivery attempts. It does not guarantee that an unavailable or permanently rejecting destination will receive a payload, and it does not provide exactly-once HTTP side effects. Receivers must deduplicate the stable event/destination delivery ID.

## Destination state and completion

At the first dispatch, the worker snapshots the organization's active destination IDs into `destination_deliveries`, under the coordinator's row lock. The `(outbox_message_id, destination_id)` primary key prevents duplicate fanout rows. Later destination additions are excluded from that snapshot. URL, headers, timeout and rate-limit configuration are read again on retries; SSRF validation and DNS pinning run on every HTTP attempt.

Each destination has its own `PENDING`, `DISPATCHED` or `DEAD_LETTER` status, attempt counter and retry time. Successful targets are not retried when another target fails. A committed successful attempt is reconciled on recovery if the worker crashed before recording the coordinator outcome. Deleted/deactivated targets become explicit dead letters; their durable state does not silently disappear.

The original outbox row remains the coordinator:

- Any pending target: outbox `PENDING`, event `PROCESSING`, next wake-up at the earliest unfinished target's retry time.
- All targets successful, or an empty initial snapshot: outbox `DISPATCHED`, event `COMPLETED`.
- No pending targets and at least one dead letter: outbox `DEAD_LETTER`, event `FAILED`.

Coordinator claim counts are separate from destination attempt counts. An attempt is reserved durably before egress; a crash before the HTTP send can consume a reservation without receipt. Configuration/secret/database errors at the coordinator can also require retry or operator recovery.

## Retry policy and manual replay

`max_retries = 5` is five total attempts per target, including the first attempt. HTTP 408/429/5xx and transport failures are retryable; other non-success statuses and SSRF policy rejection are permanent. Ambiguous transport timeouts/resets or lease-loss cancellation are recorded as `UNKNOWN` where an attempt can be persisted.

Backoff is `min(300000, 1000 * 2^(attempt - 1) + jitter(0..499))` milliseconds, with the exponent bounded by the retry-policy implementation. Retry-After seconds/dates can extend the delay within the existing five-minute cap. Redis rate-limit postponement refunds the reserved attempt and does not consume that target's retry budget. The existing limiter fails open if Redis is unavailable.

Owner/developer replay retains the existing API authorization, row locking, live-lease rejection and attribution. A replay resets unfinished targets' counters/retry times and preserves every successful target. Successful coordinators and duplicate immediate replays are rejected. Retry exhaustion and permanent failure require explicit replay after correcting the cause; receipt is not retried forever.

## Leases, fencing and shutdown

A sweep handles at most 25 coordinators, but claims only one immediately before processing it. Already visited IDs are excluded from that sweep. Unstarted messages do not age behind an earlier sequential HTTP call.

Claims use `FOR UPDATE SKIP LOCKED`, a random UUID token and a 30-second lease. A 10-second heartbeat renews only a still-live token. Another token or an expired lease cannot be revived. Destination starts/results and aggregate completion check both the token and the live deadline under the coordinator lock. No HTTP request starts without a fresh lease check. Renewal failure signals cancellation to the in-flight HTTP attempt and prevents further targets from starting.

Database fencing cannot undo bytes already sent. A worker may crash after the receiver commits but before local acknowledgement/attempt persistence; a later worker can resend the same delivery ID. A paused process or network/database partition also leaves a gap between the last fence and egress. Receiver-side atomic deduplication remains necessary. Retain deduplication records for the full retry/manual-replay period.

PR #2's graceful shutdown drain remains in place. Shutdown stops claiming and starting additional targets, waits for active delivery/recovery/renewal work, records partial progress, then allows Nest to close PostgreSQL and Redis. Unfinished targets can resume without repeating durable successes. Platform termination grace must allow the current event's active HTTP work and database operations to finish; forced termination follows the crash-recovery path.

Workflow-channel coordinators retain the workflow engine's own step retry/state machine; this destination snapshot is for ordinary webhook fanout. Their outer coordinator leases also use just-in-time claiming and renewal. This change does not claim to solve every workflow external-side-effect ambiguity.

## Signing and identifiers

An event is joined to its originating `events.endpoint_id`, with matching organization IDs, to retrieve the encrypted signing secret. It never uses the organization's first active endpoint. Retries use that origin endpoint's current secret; this is not a historical secret-version snapshot. Deleting an endpoint still cascades its event/outbox data under the existing schema.

The HMAC covers `${timestamp}.${body}` and is sent as `t=<timestamp>,v1=<digest>`. Signature/header protections, secret redaction, mandatory signing and outbound SSRF restrictions remain enforced.

| Header | Identity |
| --- | --- |
| `Idempotency-Key`, `x-relayforge-delivery`, `x-relayforge-delivery-id` | Stable ID derived from event ID and destination ID, unchanged across retries, worker recovery and replay |
| `x-relayforge-attempt-id` | Fresh UUID for each transport attempt |
| `x-relayforge-attempt` | Per-target reservation number; resets for explicit replay |
| `x-relayforge-event-id`, `x-relayforge-destination-id` | Stable source/target IDs |
| `x-relayforge-timestamp`, `x-relayforge-signature` | Recomputed for each attempt; timestamps have seconds precision |

## Isolation and migration

The destination-state table has forced RLS and organization/member-scoped API reads. The API cannot directly mutate target outcomes. Worker mutation helpers require a live coordinator lease, have fixed search paths and revoke PUBLIC execution. A composite foreign key binds each state row to its coordinator's organization. Destination IDs intentionally remain as tombstones after destination deletion.

See [the migration and reliability review](delivery-reliability-review.txt) before rollout. Old and new fanout workers must not overlap. Historically completed mixed-outcome events are not automatically reopened or redelivered.

Use the [controlled staging checklist](delivery-staging-checklist.md) for dedicated
role checks, backup/restore, index-lock planning, historical recovery and synthetic
acceptance. Repository configuration and local tests do not verify hosted roles.
