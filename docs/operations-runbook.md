# RelayForge Production Operations & Incident Response Runbook

## 1. Golden Signals & Alerting Thresholds

RelayForge monitors 4 primary reliability vectors. Configure alert triggers in Datadog, Prometheus/Alertmanager, or AWS CloudWatch:

| Metric | Normal Range | Warning Threshold | Critical Alert | Mitigation Runbook |
| :--- | :--- | :--- | :--- | :--- |
| **Worker Heartbeat Age** | < 15 seconds | > 30 seconds | > 60 seconds | Section 2.1 (Worker Failure) |
| **Outbox Queue Lag (Pending)** | < 100 messages | > 1,000 messages | > 5,000 messages | Section 2.2 (Backlog Growth) |
| **DLQ Insertion Rate** | < 0.1% | > 1.0% | > 5.0% | Section 2.3 (DLQ Spike) |
| **Outbound 429 Saturation** | < 2% | > 10% | > 25% | Section 2.4 (Destination Rate Limiting) |
| **API p99 Ingestion Latency** | < 25 ms | > 100 ms | > 250 ms | Section 2.5 (Ingestion Saturation) |

---

## 2. Incident Response Playbooks

### 2.1 Worker Crash Loop or Stale Lease Accumulation
**Symptoms:** Worker logs show repeated terminations, or outbox messages remain in `PROCESSING` status beyond lease duration.

**Diagnostic Commands:**
```sql
-- Check count of stuck leases
SELECT count(*), max(now() - lease_expires_at) AS max_stale_duration
FROM outbox_messages
WHERE status = 'PROCESSING' AND lease_expires_at < now();
```

**Resolution:**
1. Check worker logs for unhandled exceptions or OOM events:
   ```bash
   docker logs --tail 200 relayforge-worker
   ```
2. The RelayForge worker automatically recovers expired leases on every poll cycle via fenced tokens (`SELECT ... FOR UPDATE SKIP LOCKED WHERE lease_expires_at < now()`).
3. If memory limits caused the crash, increase `WORKER_CONCURRENCY` memory ceiling or scale out worker replicas.

### 2.2 Outbox Queue Backlog Growth
**Symptoms:** Ingestion volume exceeds outbox drain rate; pending messages count climbs continuously.

**Diagnostic Commands:**
```sql
SELECT status, count(*) FROM outbox_messages GROUP BY status;
```

**Resolution:**
1. Scale up Worker instances horizontally (e.g. from 2 to 4 containers).
2. Check if specific slow downstream destinations are holding worker concurrency slots. RelayForge enforces 5000ms timeouts per HTTP action.
3. Review Redis token-bucket rate limiter metrics in the RelayForge Metrics Dashboard (`/metrics`).

### 2.3 Dead Letter Queue (DLQ) Spikes
**Symptoms:** DLQ Console displays sharp increase in failed events.

**Diagnostic Commands:**
```sql
SELECT failure_reason, count(*)
FROM delivery_attempts
WHERE status = 'FAILED' AND attempt_number >= 5
GROUP BY failure_reason;
```

**Resolution:**
1. Open the RelayForge DLQ Console (`/dlq`).
2. Filter failed events by Destination ID or error pattern (e.g. `ETIMEDOUT`, `HTTP 500 Internal Server Error`).
3. If downstream service experienced an outage and has recovered, trigger **Bulk Replay** from the DLQ Console or via API:
   ```bash
   POST /v1/organizations/:orgId/dlq/bulk-replay
   { "destinationId": "...", "limit": 100 }
   ```

### 2.4 Downstream Destination Rate Limiting (HTTP 429)
**Symptoms:** Deliveries return HTTP 429 Too Many Requests; outbox messages reschedule to respect `Retry-After`.

**Resolution:**
1. RelayForge automatically parses standard `Retry-After` headers (seconds or HTTP date) and schedules exponential backoff with bounded jitter.
2. In the RelayForge Console, adjust the destination's rate limit parameters (Rate limit window & Max requests per window) to throttle traffic before hitting downstream limits.

### 2.5 Ingestion Saturation & Database Pool Starvation
**Symptoms:** API returns HTTP 503 or logs `PrismaClientKnownRequestError: Timed out fetching a connection from the pool`.

**Resolution:**
1. Check PostgreSQL active connections:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
2. Increase `DATABASE_POOL_SIZE` in the API environment (up to PostgreSQL `max_connections` ceiling).
3. Ensure PostgreSQL server resources (CPU, RAM) have sufficient capacity for connection scaling.

---

## 3. Routine Operational Maintenance

### 3.1 Outbox & Delivery Log Archival
For high-volume installations (> 1,000,000 events/day), prune or archive completed outbox messages older than 30 days:
```sql
DELETE FROM outbox_messages
WHERE status = 'DELIVERED'
  AND completed_at < NOW() - INTERVAL '30 days';
```

### 3.2 Key Rotation Protocol (AES-256-GCM)
1. Add new key to key ring configuration.
2. Existing secrets remain decryptable with their corresponding version tag.
3. Trigger re-encryption background script to migrate old ciphertexts to the new master key.
