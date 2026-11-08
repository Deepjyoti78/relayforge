# RelayForge Delivery Architecture

## 1. At-Least-Once Delivery Semantics

RelayForge guarantees **at-least-once delivery** for all registered webhook destinations.
In distributed computing over asynchronous networks, network partitions, worker crashes, and destination timeouts make network receipt confirmation fundamentally ambiguous. RelayForge does **not** make mathematically impossible "exactly-once" delivery claims.

Downstream destinations must ensure idempotent processing by inspecting the headers sent by RelayForge.

### Identification & Idempotency Headers

Every outbound HTTP request sent by RelayForge carries distinct headers separating logical delivery identity from individual attempt attempts:

| Header | Description | Mutability across retries |
| :--- | :--- | :--- |
| `Idempotency-Key` | Deterministic UUID (`getStableDeliveryId(eventId, destinationId)`) | **Stable** (Identical across all retries and manual replays) |
| `x-relayforge-delivery` | Canonical logical delivery ID | **Stable** (Identical across all retries) |
| `x-relayforge-delivery-id`| Alias for logical delivery ID | **Stable** (Identical across all retries) |
| `x-relayforge-attempt-id` | Unique UUID generated freshly for each individual HTTP transmission | **Unique per attempt** |
| `x-relayforge-attempt` | Ordinal counter of the attempt (1, 2, 3...) | **Increments per attempt** |
| `x-relayforge-event-id` | UUID of the ingested source event | **Stable** |
| `x-relayforge-destination-id` | UUID of the target destination | **Stable** |
| `x-relayforge-timestamp` | Fresh Unix epoch timestamp (seconds) generated when sending | **Fresh per attempt** |
| `x-relayforge-signature` | HMAC-SHA256 signature computed over `t={timestamp}.{body}` | **Fresh per attempt** |

### Downstream Receiver Guidance
Receivers should store the `Idempotency-Key` or `x-relayforge-delivery` in an atomic key-value store or database with unique constraints. If a duplicate delivery arrives (e.g. after a network timeout where the receiver succeeded but the response ack was dropped), the receiver can acknowledge with HTTP 200 without executing side effects twice.

---

## 2. Retry Policy & Error Classification

### Max Attempts vs. Retries
A destination configured with `max_retries = 5` means:
- **1 initial delivery attempt**
- **Up to 4 retries** (5 total attempts maximum)

### Status Classification
- **Retryable Transient Failures:**
  - HTTP `408 Request Timeout`
  - HTTP `429 Too Many Requests`
  - HTTP `500 Internal Server Error`
  - HTTP `502 Bad Gateway`
  - HTTP `503 Service Unavailable`
  - HTTP `504 Gateway Timeout`
  - Transport timeouts & socket resets (classified as `UNKNOWN`)
- **Permanent Non-Retryable Failures (Immediate Dead Letter Queue):**
  - HTTP `400 Bad Request`
  - HTTP `401 Unauthorized`
  - HTTP `403 Forbidden`
  - HTTP `404 Not Found`
  - HTTP `405 Method Not Allowed`
  - HTTP `410 Gone`
  - HTTP `422 Unprocessable Entity`
  - SSRF Security Policy Rejections

### Bounded Exponential Backoff with Additive Jitter
Retry intervals are calculated using exponential backoff with additive uniform jitter (0–499ms) to eliminate thundering herd synchronization:
$$\text{delay} = \min(\text{maxDelayMs}, \text{baseDelayMs} \times 2^{\text{attempt} - 1}) + \text{random}(0, 500\text{ms})$$
- Default `baseDelayMs`: 1,000ms (1s)
- Default `maxDelayMs`: 300,000ms (5 minutes)

### Retry-After Adherence
When a destination returns HTTP 429 or 503 with a `Retry-After` header:
- **Delta seconds:** e.g. `Retry-After: 120` schedules retry at least 120 seconds in the future.
- **HTTP date:** e.g. `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT` parses the target date.
- **Policy Upper Bound:** If `Retry-After` exceeds `maxDelayMs` (300,000ms), RelayForge caps the delay at 5 minutes rather than delaying indefinitely or risking memory exhaustion.

---

## 3. Distributed Lease Concurrency & Worker Fault Tolerance

### Transactional Outbox Pattern
1. Webhooks are ingested and written to the `events` and `outbox_messages` tables inside a single atomic database transaction.
2. Background workers claim batches of pending outbox messages using PostgreSQL row-level locks:
   ```sql
   SELECT id, lease_token FROM claim_pending_outbox_messages(batch_size, lease_seconds)
   FOR UPDATE SKIP LOCKED;
   ```
3. Each claim issues a cryptographically random `lease_token UUID`.

### Optimistic Lease Concurrency Protection
To prevent slow, delayed, or zombie workers from clobbering new worker state after a lease expires:
- `complete_outbox_dispatch` and `schedule_outbox_retry` require `p_lease_token UUID`.
- SQL updates enforce `WHERE id = p_outbox_id AND lease_token = p_lease_token AND status = 'PENDING'`.
- If Worker A's lease expires and Worker B reclaims the job (acquiring `lease_token_B`), Worker A's subsequent completion attempt affects 0 rows and returns `FALSE`. Worker A cannot overwrite Worker B's progress.

### Atomic Replay Protection
- Deliveries in `DISPATCHED` status **cannot** be replayed (returns HTTP 400).
- Deliveries currently in-flight by an active worker (`lease_expires_at > NOW()`) **cannot** be concurrently replayed (returns HTTP 400).
- Concurrent replay requests for the same DLQ message are locked with `FOR UPDATE`; only the first transitions the row, and duplicate attempts are rejected.
- Audit attribution (`replayed_by` and `replayed_at`) is persisted upon manual replay.

---

## 4. Ambiguous Outcomes (`UNKNOWN` Status)

When an HTTP transport timeout or socket reset (`ECONNRESET`) occurs after a request was transmitted, RelayForge records `status = 'UNKNOWN'`. 
- **FAILED:** Transport drops that occurred *before* bytes reached the server (e.g. connection refused `ECONNREFUSED`, unresolvable DNS, SSRF egress blocked).
- **UNKNOWN:** Transport timeouts where destination receipt is ambiguous.
