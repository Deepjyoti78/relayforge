# Why this foundation exists

The first milestone answers a small question: can the API, database, queue, and
worker run independently, connect with the right privileges, and fail visibly?
It does not yet claim that webhook events are accepted or delivered.

## Follow one health request

1. The browser calls `GET /health/ready`.
2. Logging middleware generates a fresh `x-request-id`; incoming IDs are untrusted.
3. The controller runs a bounded PostgreSQL probe through Prisma.
4. It returns 200 when the query succeeds or a safe 503 response when it fails.
5. A JSON log records the request ID, method, path, status, and duration. Headers,
   query strings, bodies, and raw connection error messages are excluded.

`/health/live` does not query dependencies. A database outage should make the API
unready, not cause a liveness probe to repeatedly restart a healthy Node process.

Redis is deliberately absent from API initialization. Later, accepting an event
will require a PostgreSQL transaction with an outbox record, not a successful
immediate Redis write. Hard admission quotas will bound the backlog during outages.

## Follow one worker probe

1. The smoke test places `health.ping` on the private operational queue.
2. The separate worker validates the tiny probe payload.
3. The worker queries PostgreSQL and returns its instance ID.
4. BullMQ's event stream delivers the result to the probe client.

This proves that a consumer is actually running. Redis `PING` by itself would
only prove that Redis is alive. The operational queue accepts no webhook jobs;
business work will get its own outbox-backed queue in the delivery milestone.

Each worker also registers a database heartbeat with a random instance ID. It
refreshes the row without overlapping writes, stops its timer on shutdown, and
removes only its own row. A crashed process can leave a stale row: consumers must
check `last_seen_at`, not count every stored row as a live worker. Stale-row
retention will be added with operational maintenance.

## Why three PostgreSQL identities?

- `relayforge_admin` applies migrations and grants access.
- `relayforge_api` can read operational worker state.
- `relayforge_worker` can register and update worker state.

The application refuses to start with superuser, role-creation, database-creation,
or RLS-bypass privileges. The runtime accounts do not own the tables. Future
migrations must include reviewed grants for new tables; they must not grant
blanket ownership to a runtime account.

This does not yet implement tenant isolation. Organization tables, composite
foreign keys, authorized tenant context, and RLS policies form the next milestone.

## Why persistent Redis with noeviction?

Redis cache configurations commonly remove keys to free memory. Removing arbitrary
queue keys can corrupt queue behavior. Worker startup verifies the noeviction
policy. The development service also enables append-only persistence.

Queue persistence still does not make Redis the durable record of accepted
events. PostgreSQL checkpoints and reconciliation will provide that guarantee.

## Scope and trade-offs

One backend package and two entry points avoid premature workspace/build-system
complexity. Shared modules contain infrastructure; domain modules will be added
as complete features rather than empty folders for every future requirement.

API and worker containers use the same non-root runtime image. A separate tooling
stage contains the migration CLI. The migration administrator URL is supplied
only to the one-shot migration service, not to either runtime container.

All current Docker credentials and volume initialization scripts are local-only.
PostgreSQL initialization scripts run when a database volume is first created;
editing an initialization file does not update roles in an existing volume.
Role changes on existing databases require a deliberate migration/provisioning
operation, not deleting a database volume.

The Docker Compose deployment demonstrates process separation. It does not
provide multi-region availability or a production security boundary.
